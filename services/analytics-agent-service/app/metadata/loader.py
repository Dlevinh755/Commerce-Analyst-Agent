import yaml
from pathlib import Path


def load_catalog() -> dict:
    path = Path(__file__).parent / "catalog.yaml"
    with path.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f)