"""Top-K recommendations — plan sections 11–12."""

import os
import logging
import httpx

from .connect_qdrant import get_client
from .config.databricks_config import (
    DATABRICKS_PRODUCTS_ID_COLUMN,
    DATABRICKS_PRODUCTS_SOURCE,
    DATABRICKS_PRODUCTS_SQL,
)
from .config.qdrant_config import BOOK_COLLECTION, TOP_K, USER_COLLECTION
from .databricks_client import DatabricksClient, is_configured as databricks_is_configured
from .utils import to_qdrant_point_id

logger = logging.getLogger(__name__)

# Internal product-service URL (Docker network) — used in dev / non-Databricks mode
PRODUCT_SERVICE_URL = os.getenv("PRODUCT_SERVICE_URL", "http://product-service:8001")

# Fetch extra Qdrant hits so we can skip books missing from dim_books / product-service
OVERSAMPLE_FACTOR = max(int(os.getenv("RECOMMENDER_OVERSAMPLE_FACTOR", "5")), 1)
MAX_CANDIDATES = max(int(os.getenv("RECOMMENDER_MAX_CANDIDATES", "30")), 1)


# ---------------------------------------------------------------------------
# Helpers — Databricks enrichment
# ---------------------------------------------------------------------------

def _build_products_query(product_ids: list[str]) -> str | None:
    if not product_ids:
        return None

    ids_sql = ",".join(f"'{product_id}'" for product_id in product_ids)

    if DATABRICKS_PRODUCTS_SQL:
        return (
            "SELECT * FROM ("
            + DATABRICKS_PRODUCTS_SQL
            + ") AS products WHERE CAST(product_id AS STRING) IN ("
            + ids_sql
            + ")"
        )

    if DATABRICKS_PRODUCTS_SOURCE:
        return (
            "SELECT * FROM "
            + DATABRICKS_PRODUCTS_SOURCE
            + " WHERE CAST("
            + DATABRICKS_PRODUCTS_ID_COLUMN
            + " AS STRING) IN ("
            + ids_sql
            + ")"
        )

    return None


def _maybe_enrich_from_databricks(recommendations: list[dict]) -> list[dict]:
    if os.getenv("RECOMMENDER_DATA_SOURCE", "").lower() != "databricks":
        return recommendations

    if not databricks_is_configured():
        return recommendations

    product_ids = [str(rec["book_id"]) for rec in recommendations]
    sql_text = _build_products_query(product_ids)
    if not sql_text:
        return recommendations

    client = DatabricksClient()
    try:
        rows = client.query(sql_text)
    finally:
        client.close()

    product_map: dict[str, dict] = {}
    for row in rows:
        product_id = (
            row.get("product_id")
            or row.get("book_id")
            or row.get(DATABRICKS_PRODUCTS_ID_COLUMN)
        )
        if product_id is not None:
            product_map[str(product_id)] = row

    enriched = []
    for rec in recommendations:
        product = product_map.get(str(rec["book_id"]))
        if product:
            enriched.append({**rec, "product": product})
        else:
            logger.debug("dim_books missing book_id=%s", rec["book_id"])

    return enriched


# ---------------------------------------------------------------------------
# Helpers — local product-service enrichment (dev / non-Databricks mode)
# ---------------------------------------------------------------------------

def _enrich_from_product_service(recommendations: list[dict]) -> list[dict]:
    """Fetch full book details from the internal product-service for each hit."""
    enriched = []
    with httpx.Client(timeout=10.0) as client:
        for rec in recommendations:
            book_id = rec["book_id"]
            try:
                resp = client.get(f"{PRODUCT_SERVICE_URL}/books/{book_id}")
                if resp.status_code == 200:
                    enriched.append({**rec, "product": resp.json()})
                else:
                    logger.debug(
                        "product-service returned %s for book_id=%s",
                        resp.status_code,
                        book_id,
                    )
            except Exception as exc:
                logger.debug(
                    "Failed to fetch book %s from product-service: %s", book_id, exc
                )
    return enriched


def _enrich_recommendations(recommendations: list[dict]) -> list[dict]:
    """Enrich hits with full product details (Databricks in prod, product-service in dev)."""
    data_source = os.getenv("RECOMMENDER_DATA_SOURCE", "").lower()
    if data_source == "databricks" and databricks_is_configured():
        return _maybe_enrich_from_databricks(recommendations)
    return _enrich_from_product_service(recommendations)


# ---------------------------------------------------------------------------
# Core recommendation function
# ---------------------------------------------------------------------------

def _search_qdrant(client, query_vector, k: int):
    """Try multiple Qdrant client API variants for compatibility."""

    def _try_call(method, **kwargs):
        try:
            return method(**kwargs)
        except Exception:
            return None

    results = None
    if hasattr(client, "search"):
        results = _try_call(
            client.search,
            collection_name=BOOK_COLLECTION,
            query_vector=query_vector,
            limit=k,
        )
    if results is None and hasattr(client, "search_points"):
        results = _try_call(
            client.search_points,
            collection_name=BOOK_COLLECTION,
            query_vector=query_vector,
            limit=k,
        )
    if results is None and hasattr(client, "query_points"):
        results = _try_call(
            client.query_points,
            collection_name=BOOK_COLLECTION,
            query_vector=query_vector,
            limit=k,
        ) or _try_call(
            client.query_points,
            collection_name=BOOK_COLLECTION,
            query=query_vector,
            limit=k,
        )
    if results is None and hasattr(client, "query"):
        results = _try_call(
            client.query,
            collection_name=BOOK_COLLECTION,
            query_vector=query_vector,
            limit=k,
        ) or _try_call(
            client.query,
            collection_name=BOOK_COLLECTION,
            query=query_vector,
            limit=k,
        )
    if results is None:
        raise RuntimeError("Qdrant client has no compatible search method.")
    return results


def _candidate_limit(requested_k: int) -> int:
    """How many Qdrant hits to retrieve before filtering to requested_k."""
    return min(max(requested_k * OVERSAMPLE_FACTOR, requested_k + 10), MAX_CANDIDATES)


def get_recommendations(user_id: int, top_k: int | None = None) -> dict:
    k = top_k or TOP_K
    client = get_client()

    user_points = client.retrieve(
        collection_name=USER_COLLECTION,
        ids=[to_qdrant_point_id(user_id)],
        with_vectors=True,
    )

    if not user_points or user_points[0].vector is None:
        return {"user_id": user_id, "recommendations": []}

    query_vector = user_points[0].vector
    results = _search_qdrant(client, query_vector, _candidate_limit(k))
    hits_source = results.points if hasattr(results, "points") else results
    hits = sorted(hits_source, key=lambda h: h.score, reverse=True)

    candidates = [
        {"book_id": int(hit.id), "score": round(hit.score, 4)} for hit in hits
    ]

    enriched = _enrich_recommendations(candidates)
    # Preserve Qdrant score order; drop hits with no catalog row (Qdrant-only orphans).
    recommendations = enriched[:k]

    return {"user_id": user_id, "recommendations": recommendations}
