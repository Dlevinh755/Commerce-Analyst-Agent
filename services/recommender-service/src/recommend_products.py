from __future__ import annotations

import json
import logging
import os
from pathlib import Path
import sys
import threading
import time
import unicodedata
from typing import Any, Dict, List, Optional

# Fallback image URL used when the upstream data source (e.g. Databricks) does
# not store an img_url column. Override via the IMAGE_FALLBACK_URL env var.
_IMAGE_FALLBACK_URL: str = (
	os.getenv("IMAGE_FALLBACK_URL", "").strip()
 
	or "https://images.unsplash.com/photo-1526243741027-444d633d7365?auto=format&fit=crop&w=300&q=80"
)

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

CURRENT_DIR = Path(__file__).resolve().parent
if str(CURRENT_DIR) not in sys.path:
	sys.path.append(str(CURRENT_DIR))

from cf import (
	CollaborativeFilteringRecommender,
	DatabricksSourceConfig,
	Product,
	Recommendation,
	get_default_seed_path,
)


BOOK_CATEGORY_KEYWORDS = (
	"sach",
	"book",
	"tieu thuyet",
	"truyen",
	"van hoc",
)


def _normalize_text(value: str) -> str:
	collapsed = " ".join(value.strip().lower().split())
	return "".join(
		char for char in unicodedata.normalize("NFD", collapsed) if unicodedata.category(char) != "Mn"
	)


def _is_book_category(category: str) -> bool:
	normalized = _normalize_text(category)
	return any(keyword in normalized for keyword in BOOK_CATEGORY_KEYWORDS)


class RecommendRequest(BaseModel):
	username: str = Field(..., description="Buyer username")
	clicked_product_title: str = Field(..., description="Product title user clicked")
	clicked_seller_username: Optional[str] = Field(
		default=None,
		description="Optional seller username for disambiguation",
	)
	clicked_category: Optional[str] = Field(
		default=None,
		description="Optional product category from frontend",
	)
	top_n: int = Field(default=5, ge=1, le=5)


class RecommendationItem(BaseModel):
	product_id: int
	title: str
	seller_username: str
	category: str
	price: float
	score: float
	image_url: str
	rating_average: float
	review_count: int


class RecommendResponse(BaseModel):
	username: str
	clicked_product_title: str
	clicked_seller_username: Optional[str]
	clicked_is_book: bool
	recommendations: List[RecommendationItem]


app = FastAPI(title="Recommender Service", version="1.0.0")
LOGGER = logging.getLogger("recommender-service")

_model: Optional[CollaborativeFilteringRecommender] = None
_model_source: str = "unknown"
_model_source_meta: Dict[str, Any] = {}
_model_lock = threading.Lock()
_shutdown_event = threading.Event()
_kafka_thread: Optional[threading.Thread] = None
_last_refit_ts: float = 0.0


def _parse_bool(value: Optional[str], default: bool = True) -> bool:
	if value is None:
		return default
	return value.strip().lower() in {"1", "true", "yes", "on"}


def _safe_json_loads(value: object) -> Dict[str, Any]:
	if isinstance(value, dict):
		return value
	if isinstance(value, bytes):
		try:
			value = value.decode("utf-8", errors="ignore")
		except Exception:
			return {}
	if isinstance(value, str):
		try:
			parsed = json.loads(value)
			return parsed if isinstance(parsed, dict) else {}
		except json.JSONDecodeError:
			return {}
	return {}


def _fit_model() -> None:
	global _model, _model_source, _model_source_meta
	recommender = CollaborativeFilteringRecommender(k_neighbors=30, min_similarity=0.15)
	data_source = (os.getenv("RECOMMENDER_DATA_SOURCE") or "auto").strip().lower()
	databricks_config = DatabricksSourceConfig.from_env()

	if data_source not in {"auto", "seed", "databricks"}:
		raise RuntimeError(
			"RECOMMENDER_DATA_SOURCE must be one of: auto, seed, databricks"
		)

	if data_source in {"auto", "databricks"} and databricks_config is not None:
		try:
			recommender.fit_from_databricks(databricks_config)
			_model = recommender
			_model_source = "databricks"
			_model_source_meta = {
				"catalog": databricks_config.catalog,
				"schema": databricks_config.schema,
			}
			LOGGER.warning(
				"RECOMMENDER_SOURCE=databricks catalog=%s schema=%s users=%s products=%s",
				databricks_config.catalog,
				databricks_config.schema,
				len(recommender.user_to_idx),
				len(recommender.products),
			)
			return
		except Exception:
			if data_source == "databricks":
				raise
			LOGGER.exception("RECOMMENDER_SOURCE=databricks failed; fallback_to=seed")

	seed_path = get_default_seed_path()
	recommender.fit_from_seed(seed_path)
	_model = recommender
	_model_source = "seed"
	_model_source_meta = {"seed_path": str(seed_path)}
	LOGGER.warning(
		"RECOMMENDER_SOURCE=seed seed_path=%s users=%s products=%s",
		seed_path,
		len(recommender.user_to_idx),
		len(recommender.products),
	)


def _maybe_refit(reason: str) -> None:
	global _last_refit_ts
	cooldown = int(os.getenv("RECOMMENDER_REFIT_COOLDOWN_SEC", "60").strip() or 60)
	now = time.time()
	if now - _last_refit_ts < cooldown:
		return
	with _model_lock:
		now = time.time()
		if now - _last_refit_ts < cooldown:
			return
		LOGGER.warning("Recommender refit triggered: %s", reason)
		_fit_model()
		_last_refit_ts = time.time()


def _start_kafka_consumer() -> None:
	global _kafka_thread
	if _kafka_thread is not None:
		return
	if not _parse_bool(os.getenv("RECOMMENDER_KAFKA_REFIT", "true"), True):
		LOGGER.warning("Kafka refit disabled via RECOMMENDER_KAFKA_REFIT")
		return

	def _consume() -> None:
		try:
			from kafka import KafkaConsumer  # noqa: PLC0415
		except Exception as exc:
			LOGGER.warning("Kafka consumer unavailable: %s", exc)
			return

		bootstrap = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:29092").strip()
		topic = os.getenv("KAFKA_ORDERS_TOPIC", "orders").strip() or "orders"
		event_name = (os.getenv("ORDER_TOPIC") or "order.created").strip()

		try:
			consumer = KafkaConsumer(
				topic,
				bootstrap_servers=bootstrap,
				auto_offset_reset="latest",
				enable_auto_commit=True,
				value_deserializer=_safe_json_loads,
				consumer_timeout_ms=1000,
			)
			LOGGER.warning(
				"Kafka consumer started topic=%s bootstrap=%s event=%s",
				topic,
				bootstrap,
				event_name,
			)
		except Exception as exc:
			LOGGER.warning("Kafka consumer init failed: %s", exc)
			return

		try:
			while not _shutdown_event.is_set():
				for message in consumer:
					if _shutdown_event.is_set():
						break
					payload = message.value if isinstance(message.value, dict) else _safe_json_loads(message.value)
					event = str(payload.get("event", "")).strip()
					if event == event_name:
						_maybe_refit(f"kafka:{event}")
						break
		finally:
			consumer.close()

	_kafka_thread = threading.Thread(target=_consume, name="recommender-kafka", daemon=True)
	_kafka_thread.start()


def _find_product_in_catalog(
	model: CollaborativeFilteringRecommender,
	title: str,
	seller_username: Optional[str] = None,
) -> Optional[Product]:
	title_norm = _normalize_text(title)
	seller_norm = _normalize_text(seller_username) if seller_username else None

	for product in model.products.values():
		if _normalize_text(product.title) != title_norm:
			continue
		if seller_norm and _normalize_text(product.seller_username) != seller_norm:
			continue
		return product
	return None


def _filter_only_books(recs: List[Recommendation]) -> List[Recommendation]:
	filtered: List[Recommendation] = []
	for rec in recs:
		# Keep unknown as fallback because some seed snapshots do not store category.
		if rec.category.strip().lower() == "unknown" or _is_book_category(rec.category):
			filtered.append(rec)
	return filtered


@app.on_event("startup")
def startup_load_model() -> None:
	_fit_model()
	_start_kafka_consumer()


@app.on_event("shutdown")
def shutdown_consumer() -> None:
	_shutdown_event.set()


@app.get("/health")
def health() -> dict:
	if _model is None:
		return {"status": "error", "detail": "Model is not loaded"}

	return {
		"status": "ok",
		"model_source": _model_source,
		"model_source_meta": _model_source_meta,
		"users": len(_model.user_to_idx),
		"products": len(_model.products),
	}


@app.post("/recommendations/cf", response_model=RecommendResponse)
def recommend_products(payload: RecommendRequest) -> RecommendResponse:
	model = _model
	if model is None:
		raise HTTPException(status_code=500, detail="Model is not loaded")

	source_product = _find_product_in_catalog(
		model=model,
		title=payload.clicked_product_title,
		seller_username=payload.clicked_seller_username,
	)
	clicked_is_book = False
	if payload.clicked_category:
		clicked_is_book = _is_book_category(payload.clicked_category)
	elif source_product is not None:
		clicked_is_book = _is_book_category(source_product.category)

	# Ask for a wide candidate set, then enforce top-N constraints at API layer.
	# This avoids returning too few items after book-category filtering.
	requested_candidates = max(payload.top_n * 20, 200)
	candidates = model.recommend_for_user(username=payload.username, top_n=requested_candidates)
	if not candidates:
		return RecommendResponse(
			username=payload.username,
			clicked_product_title=payload.clicked_product_title,
			clicked_seller_username=payload.clicked_seller_username,
			clicked_is_book=clicked_is_book,
			recommendations=[],
		)

	if clicked_is_book:
		candidates = _filter_only_books(candidates)

	# Prioritize higher-rated books in the final response list.
	candidates = sorted(
		candidates,
		key=lambda item: (item.rating_average, item.review_count, item.score),
		reverse=True,
	)

	top_items = candidates[: payload.top_n]
	mapped = [
		RecommendationItem(
			product_id=item.product_id,
			title=item.title,
			seller_username=item.seller_username,
			category=item.category,
			price=item.price,
			score=item.score,
			# img_url is not stored in the Databricks source; use the configured fallback.
			image_url=_IMAGE_FALLBACK_URL,
			rating_average=item.rating_average,
			review_count=item.review_count,
		)
		for item in top_items
	]

	return RecommendResponse(
		username=payload.username,
		clicked_product_title=payload.clicked_product_title,
		clicked_seller_username=payload.clicked_seller_username,
		clicked_is_book=clicked_is_book,
		recommendations=mapped,
	)


def get_seed_path() -> Path:
	return get_default_seed_path()