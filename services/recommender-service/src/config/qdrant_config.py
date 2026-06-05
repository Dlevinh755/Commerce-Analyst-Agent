"""Qdrant settings for the recommendation API."""

import os

QDRANT_URL = os.getenv("QDRANT_URL", "")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY", "")
BOOK_COLLECTION = os.getenv("BOOK_COLLECTION", "book_embeddings")
USER_COLLECTION = os.getenv("USER_COLLECTION", "user_embeddings")
TOP_K = int(os.getenv("TOP_K", "20"))
