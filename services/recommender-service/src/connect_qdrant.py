"""Create and return a Qdrant client instance."""

from qdrant_client import QdrantClient
from dotenv import load_dotenv

from .config.qdrant_config import QDRANT_API_KEY, QDRANT_URL

load_dotenv()

_client: QdrantClient | None = None


def get_client() -> QdrantClient:
    global _client
    if _client is None:
        _client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY, prefer_grpc=False)
    return _client


def test_connection() -> bool:
    client = get_client()
    # Qdrant exposes a health check endpoint; this will raise if unreachable.
    client.get_collections()
    return True


if __name__ == "__main__":
    if test_connection():
        print("Đã kết nối với Qdrant thành công.")
