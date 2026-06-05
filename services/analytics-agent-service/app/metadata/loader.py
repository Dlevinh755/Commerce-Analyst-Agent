from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml


@lru_cache(maxsize=1)
def load_catalog() -> dict[str, Any]:
    path = Path(__file__).parent / "catalog.yaml"
    with path.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def get_business_metrics() -> list[dict[str, Any]]:
    return load_catalog().get("business_metrics", [])


def get_table_names() -> list[str]:
    return [table["name"] for table in load_catalog().get("tables", [])]


def get_fact_like_table_names() -> list[str]:
    return [
        table["name"]
        for table in load_catalog().get("tables", [])
        if str(table.get("type", "")).startswith("fact")
    ]
