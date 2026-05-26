from __future__ import annotations

import argparse
import importlib
import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Tuple

import numpy as np
from sklearn.metrics.pairwise import cosine_similarity


def _load_databricks_sql_module() -> object:
	try:
		return importlib.import_module("databricks.sql")
	except ModuleNotFoundError:  # pragma: no cover - optional dependency in local setups.
		return None


@dataclass(frozen=True)
class Product:
	id: int
	title: str
	seller_username: str
	author: str
	category: str
	price: float
	rating_average: float
	review_count: int


@dataclass(frozen=True)
class Recommendation:
	product_id: int
	title: str
	score: float
	seller_username: str
	category: str
	price: float
	rating_average: float
	review_count: int


@dataclass(frozen=True)
class DatabricksSourceConfig:
	host: str
	http_path: str
	access_token: str
	products_sql: str
	interactions_sql: str
	reviews_sql: str
	users_source: str
	catalog: Optional[str] = None
	schema: Optional[str] = None

	@staticmethod
	def _optional_env(name: str) -> Optional[str]:
		value = os.getenv(name)
		if value is None:
			return None
		trimmed = value.strip()
		return trimmed or None

	@classmethod
	def from_env(cls) -> Optional[DatabricksSourceConfig]:
		host = cls._optional_env("DATABRICKS_HOST")
		http_path = cls._optional_env("DATABRICKS_HTTP_PATH")
		access_token = cls._optional_env("DATABRICKS_ACCESS_TOKEN")
		if not host or not http_path or not access_token:
			return None

		catalog = cls._optional_env("DATABRICKS_CATALOG")
		schema = cls._optional_env("DATABRICKS_SCHEMA")

		users_source = cls._optional_env("DATABRICKS_USERS_SOURCE") or "dim_users"
		products_source = cls._optional_env("DATABRICKS_PRODUCTS_SOURCE") or "dim_books"
		interactions_source = cls._optional_env("DATABRICKS_INTERACTIONS_SOURCE") or "fact_sales"
		reviews_source = cls._optional_env("DATABRICKS_REVIEWS_SOURCE") or "fact_reviews"

		products_sql = cls._optional_env("DATABRICKS_PRODUCTS_SQL") or (
			"SELECT CAST(book_id AS STRING) AS product_id, "
			"title, '' AS seller_username, "
			"COALESCE(author, 'Unknown') AS author, "
			"COALESCE(category_name, 'Unknown') AS category, "
			"COALESCE(price, 0) AS price "
			f"FROM {products_source}"
		)
		interactions_sql = cls._optional_env("DATABRICKS_INTERACTIONS_SQL") or (
			"SELECT u.username AS buyer_username, CAST(s.book_id AS STRING) AS product_id, "
			"SUM(COALESCE(s.quantity, 1)) AS quantity "
			f"FROM {interactions_source} s "
			f"JOIN {users_source} u ON s.buyer_id = u.user_id "
			"GROUP BY u.username, s.book_id"
		)
		reviews_sql = cls._optional_env("DATABRICKS_REVIEWS_SQL") or (
			"SELECT CAST(book_id AS STRING) AS product_id, "
			"AVG(COALESCE(score, 0)) AS rating_average, "
			"MAX(COALESCE(total_reviews_at_snapshot, 0)) AS review_count "
			f"FROM {reviews_source} "
			"GROUP BY book_id"
		)

		return cls(
			host=host,
			http_path=http_path,
			access_token=access_token,
			products_sql=products_sql,
			interactions_sql=interactions_sql,
			reviews_sql=reviews_sql,
			users_source=users_source,
			catalog=catalog,
			schema=schema,
		)


class CollaborativeFilteringRecommender:
	"""
	User-user collaborative filtering on implicit feedback built from order data.

	Signals used:
	- Purchase quantity from orders in dev-seeds.json
	"""

	def __init__(self, k_neighbors: int = 10, min_similarity: float = 0.0) -> None:
		self.k_neighbors = k_neighbors
		self.min_similarity = min_similarity

		self.user_to_idx: Dict[str, int] = {}
		self.idx_to_user: List[str] = []
		self.product_to_idx: Dict[str, int] = {}
		self.idx_to_product_key: List[str] = []

		self.products: Dict[str, Product] = {}
		self.interaction_matrix: Optional[np.ndarray] = None
		self.similarity_matrix: Optional[np.ndarray] = None

	@staticmethod
	def _safe_float(value: object, default: float = 0.0) -> float:
		try:
			return float(value)
		except (TypeError, ValueError):
			return default

	@staticmethod
	def _safe_int(value: object, default: int = 0) -> int:
		try:
			return int(value)
		except (TypeError, ValueError):
			return default

	def _product_key(self, seller_username: str, title: str) -> str:
		# Seed links order item -> product by seller + title.
		return f"{seller_username}::{title}".strip().lower()

	def fit_from_seed(self, seed_path: Path) -> None:
		with seed_path.open("r", encoding="utf-8") as f:
			payload = json.load(f)

		buyers = payload.get("buyers", [])
		products = payload.get("products", [])
		orders = payload.get("orders", [])
		reviews = payload.get("reviews", [])

		buyer_usernames = [str(b.get("username", "")).strip() for b in buyers]
		order_usernames = [str(o.get("buyer_username", "")).strip() for o in orders]
		all_usernames = sorted({u for u in buyer_usernames + order_usernames if u})

		self.user_to_idx = {username: i for i, username in enumerate(all_usernames)}
		self.idx_to_user = all_usernames

		self.products.clear()
		self.product_to_idx.clear()
		self.idx_to_product_key.clear()

		review_totals: Dict[str, Tuple[float, int]] = {}
		for review in reviews:
			seller = str(review.get("seller_username", "")).strip()
			title = str(review.get("product_title", "")).strip()
			rating = self._safe_float(review.get("rating", 0.0), 0.0)
			if not seller or not title or rating <= 0:
				continue
			key = self._product_key(seller, title)
			total, count = review_totals.get(key, (0.0, 0))
			review_totals[key] = (total + rating, count + 1)

		for pid, p in enumerate(products):
			seller = str(p.get("seller_username", "")).strip()
			title = str(p.get("title", "")).strip()
			if not seller or not title:
				continue
			seed_id_raw = p.get("product_id") or p.get("book_id") or p.get("id")
			product_id = self._safe_int(seed_id_raw, pid + 1)
			key = self._product_key(seller, title)
			review_total, review_count = review_totals.get(key, (0.0, 0))
			rating_average = (review_total / review_count) if review_count else 0.0
			self.products[key] = Product(
				id=product_id,
				title=title,
				seller_username=seller,
				author=str(p.get("author", "Unknown")),
				category=str(p.get("category") or p.get("category_name") or "Unknown"),
				price=self._safe_float(p.get("price", 0.0)),
				rating_average=rating_average,
				review_count=review_count,
			)

		# Build product index only for products present in catalog.
		self.product_to_idx = {k: i for i, k in enumerate(self.products.keys())}
		self.idx_to_product_key = [""] * len(self.product_to_idx)
		for key, idx in self.product_to_idx.items():
			self.idx_to_product_key[idx] = key

		n_users = len(self.user_to_idx)
		n_products = len(self.product_to_idx)
		matrix = np.zeros((n_users, n_products), dtype=np.float32)

		for order in orders:
			username = str(order.get("buyer_username", "")).strip()
			if username not in self.user_to_idx:
				continue

			uidx = self.user_to_idx[username]
			for item in order.get("items", []):
				seller = str(item.get("seller_username", "")).strip()
				title = str(item.get("product_title", "")).strip()
				quantity = max(0, self._safe_int(item.get("quantity", 1), 1))
				key = self._product_key(seller, title)

				pidx = self.product_to_idx.get(key)
				if pidx is None:
					continue
				matrix[uidx, pidx] += quantity

		self.interaction_matrix = matrix

		# Mean-center per user to reduce user purchase scale bias.
		centered = matrix.copy()
		nonzero_mask = centered > 0
		for uidx in range(n_users):
			row_nonzero = nonzero_mask[uidx]
			if not np.any(row_nonzero):
				continue
			row_mean = centered[uidx, row_nonzero].mean()
			centered[uidx, row_nonzero] -= row_mean

		self.similarity_matrix = cosine_similarity(centered)
		np.fill_diagonal(self.similarity_matrix, 0.0)

	@staticmethod
	def _normalize_db_row(description: Sequence[Tuple], row: Sequence[object]) -> Dict[str, object]:
		result: Dict[str, object] = {}
		for idx, column in enumerate(description):
			name = str(column[0]).strip().lower()
			result[name] = row[idx]
		return result

	def fit_from_databricks(self, config: DatabricksSourceConfig) -> None:
		databricks_sql = _load_databricks_sql_module()
		if databricks_sql is None:
			raise RuntimeError(
				"databricks-sql-connector is not installed. Add it to requirements first."
			)

		with databricks_sql.connect(
			server_hostname=config.host,
			http_path=config.http_path,
			access_token=config.access_token,
			catalog=config.catalog,
			schema=config.schema,
		) as connection:
			with connection.cursor() as cursor:
				cursor.execute(config.products_sql)
				products = [self._normalize_db_row(cursor.description, row) for row in cursor.fetchall()]

				cursor.execute(config.interactions_sql)
				interactions = [self._normalize_db_row(cursor.description, row) for row in cursor.fetchall()]

				cursor.execute(config.reviews_sql)
				reviews = [self._normalize_db_row(cursor.description, row) for row in cursor.fetchall()]

		review_metrics: Dict[str, Tuple[float, int]] = {}
		for review in reviews:
			product_id = str(review.get("product_id", "")).strip()
			if not product_id:
				continue
			rating_avg = self._safe_float(review.get("rating_average", 0.0), 0.0)
			review_count = max(0, self._safe_int(review.get("review_count", 0), 0))
			review_metrics[product_id] = (rating_avg, review_count)

		self.products.clear()
		self.product_to_idx.clear()
		self.idx_to_product_key.clear()

		for fallback_pid, product in enumerate(products):
			product_id = str(product.get("product_id", "")).strip()
			title = str(product.get("title", "")).strip()
			if not product_id or not title:
				continue

			rating_average, review_count = review_metrics.get(product_id, (0.0, 0))
			mapped_id = self._safe_int(product_id, fallback_pid)
			self.products[product_id] = Product(
				id=mapped_id,
				title=title,
				seller_username=str(product.get("seller_username", "")).strip(),
				author=str(product.get("author", "Unknown")),
				category=str(product.get("category", "Unknown")),
				price=self._safe_float(product.get("price", 0.0)),
				rating_average=rating_average,
				review_count=review_count,
			)

		self.product_to_idx = {k: i for i, k in enumerate(self.products.keys())}
		self.idx_to_product_key = [""] * len(self.product_to_idx)
		for key, idx in self.product_to_idx.items():
			self.idx_to_product_key[idx] = key

		interaction_usernames = [str(row.get("buyer_username", "")).strip() for row in interactions]
		all_usernames = sorted({username for username in interaction_usernames if username})
		self.user_to_idx = {username: i for i, username in enumerate(all_usernames)}
		self.idx_to_user = all_usernames

		n_users = len(self.user_to_idx)
		n_products = len(self.product_to_idx)
		matrix = np.zeros((n_users, n_products), dtype=np.float32)

		for row in interactions:
			username = str(row.get("buyer_username", "")).strip()
			product_id = str(row.get("product_id", "")).strip()
			quantity = max(0, self._safe_int(row.get("quantity", 0), 0))
			if not username or not product_id or quantity <= 0:
				continue
			uidx = self.user_to_idx.get(username)
			pidx = self.product_to_idx.get(product_id)
			if uidx is None or pidx is None:
				continue
			matrix[uidx, pidx] += quantity

		self.interaction_matrix = matrix

		# Mean-center per user to reduce user purchase scale bias.
		centered = matrix.copy()
		nonzero_mask = centered > 0
		for uidx in range(n_users):
			row_nonzero = nonzero_mask[uidx]
			if not np.any(row_nonzero):
				continue
			row_mean = centered[uidx, row_nonzero].mean()
			centered[uidx, row_nonzero] -= row_mean

		self.similarity_matrix = cosine_similarity(centered)
		np.fill_diagonal(self.similarity_matrix, 0.0)

	def _guard_ready(self) -> None:
		if self.interaction_matrix is None or self.similarity_matrix is None:
			raise RuntimeError("Model is not fitted. Call fit_from_seed() or fit_from_databricks() first.")

	def _get_top_neighbors(self, user_idx: int) -> np.ndarray:
		sims = self.similarity_matrix[user_idx].copy()
		# Exclude self user from neighbor candidates.
		sims[user_idx] = -np.inf

		candidate_indices = np.where(sims >= self.min_similarity)[0]
		if candidate_indices.size == 0:
			# In sparse data, fallback to top-k by similarity even when all scores are low.
			candidate_indices = np.where(np.isfinite(sims))[0]
		if candidate_indices.size == 0:
			return np.array([], dtype=np.int32)

		ranked = candidate_indices[np.argsort(sims[candidate_indices])[::-1]]
		return ranked[: self.k_neighbors]

	def recommend_for_user(self, username: str, top_n: int = 10) -> List[Recommendation]:
		self._guard_ready()
		if username not in self.user_to_idx:
			return []

		uidx = self.user_to_idx[username]
		neighbors = self._get_top_neighbors(uidx)
		if neighbors.size == 0:
			return []
		user_row = self.interaction_matrix[uidx]
		unseen = user_row == 0
		if not np.any(unseen):
			return []

		sims = self.similarity_matrix[uidx, neighbors]
		neighbor_matrix = self.interaction_matrix[neighbors, :]
		neighbor_rated = neighbor_matrix > 0

		user_rated = user_row > 0
		user_mean = user_row[user_rated].mean() if np.any(user_rated) else 0.0

		neighbor_means = np.zeros(neighbor_matrix.shape[0], dtype=np.float32)
		for nidx in range(neighbor_matrix.shape[0]):
			rated_mask = neighbor_rated[nidx]
			if not np.any(rated_mask):
				continue
			neighbor_means[nidx] = neighbor_matrix[nidx, rated_mask].mean()

		# Weighted sum of neighbors' mean-centered preferences for each item.
		centered = neighbor_matrix - neighbor_means[:, None]
		centered[~neighbor_rated] = 0.0
		weighted_scores = (sims[:, None] * centered).sum(axis=0)
		denom = (np.abs(sims)[:, None] * neighbor_rated).sum(axis=0) + 1e-9
		scores = user_mean + (weighted_scores / denom)
		scores[~unseen] = -np.inf
		scores[denom <= 1e-9] = -np.inf

		best_idxs = np.argsort(scores)[::-1]

		recs: List[Recommendation] = []
		for pidx in best_idxs:
			score = float(scores[pidx])
			if not np.isfinite(score):
				continue
			key = self.idx_to_product_key[pidx]
			product = self.products[key]
			recs.append(
				Recommendation(
					product_id=product.id,
					title=product.title,
					score=score,
					seller_username=product.seller_username,
					category=product.category,
					price=product.price,
					rating_average=product.rating_average,
					review_count=product.review_count,
				)
			)
			if len(recs) >= top_n:
				break
		return recs


def get_default_seed_path() -> Path:
	# Support both layouts without assuming a fixed parent depth:
	# - /app/src/cf.py (container) -> /app/dev-seeds.json
	# - <repo>/services/recommender-service/src/cf.py -> <repo>/dev-seeds.json
	base = Path(__file__).resolve()

	search_roots = [base.parent, *base.parents]
	for root in search_roots:
		candidate = root / "dev-seeds.json"
		if candidate.exists():
			return candidate

	# Fallback for local/dev environments where file may be mounted later.
	return base.parents[1] / "dev-seeds.json"


def main() -> None:
	parser = argparse.ArgumentParser(description="Collaborative filtering for product recommendation")
	parser.add_argument("--seed", type=str, default=str(get_default_seed_path()), help="Path to dev-seeds.json")
	parser.add_argument("--user", type=str, required=True, help="Buyer username")
	parser.add_argument("--top-n", type=int, default=10, help="Number of recommendations")
	parser.add_argument("--k", type=int, default=10, help="Number of nearest neighbors")
	parser.add_argument(
		"--min-sim", type=float, default=0.0, help="Minimum user similarity threshold"
	)
	args = parser.parse_args()

	recommender = CollaborativeFilteringRecommender(k_neighbors=args.k, min_similarity=args.min_sim)
	recommender.fit_from_seed(Path(args.seed))

	recs = recommender.recommend_for_user(username=args.user, top_n=args.top_n)
	if not recs:
		print("No recommendation available for this user with current data.")
		return

	print(f"Recommendations for {args.user}:")
	for i, rec in enumerate(recs, start=1):
		print(
			f"{i}. {rec.title} | seller={rec.seller_username} | "
			f"category={rec.category} | price={rec.price:.0f} | score={rec.score:.4f}"
		)


if __name__ == "__main__":
	main()