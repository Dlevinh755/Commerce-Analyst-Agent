from __future__ import annotations

from pathlib import Path
from typing import Any
import yaml


class SchemaIndex:
    def __init__(self, path: str = None) -> None:
        if path is None:
            path = Path(__file__).parent.parent / "metadata" / "catalog.yaml"
        self.path = Path(path)
        self.catalog = self._load()

    def _load(self) -> dict[str, Any]:
        with self.path.open("r", encoding="utf-8") as f:
            return yaml.safe_load(f)

    def get_table_map(self) -> dict[str, Any]:
        return {table["name"]: table for table in self.catalog.get("tables", [])}

    def get_metric_map(self) -> dict[str, Any]:
        return {m["name"]: m for m in self.catalog.get("business_metrics", [])}

    def retrieve_for_intent(self, metric: str | None, dimensions: list[str], source_hint: str | None) -> dict[str, Any]:
        tables = self.get_table_map()
        metrics = self.get_metric_map()

        selected: dict[str, Any] = {}

        if source_hint and source_hint in tables:
            selected[source_hint] = tables[source_hint]

        if metric and metric in metrics:
            fact = metrics[metric]["source_table"]
            if fact in tables:
                selected[fact] = tables[fact]

        dim_text = " ".join(dimensions).lower()
        
        # Match user dimension tables
        user_keywords = ["seller", "buyer", "user", "customer", "người bán", "người mua", "khách hàng", "thành viên", "người dùng"]
        if any(kw in dim_text for kw in user_keywords):
            if "dim_users" in tables:
                selected["dim_users"] = tables["dim_users"]

        # Match book/product dimension tables
        book_keywords = ["book", "category", "author", "product", "title", "sách", "thể loại", "danh mục", "tác giả", "sản phẩm", "tên", "truyện", "tiêu đề"]
        if any(kw in dim_text for kw in book_keywords):
            if "dim_books" in tables:
                selected["dim_books"] = tables["dim_books"]

        # Match date dimension tables
        date_keywords = ["date", "month", "year", "day", "quarter", "week", "time", "ngày", "tháng", "năm", "quý", "tuần", "thời gian", "thời điểm"]
        if any(kw in dim_text for kw in date_keywords):
            if "dim_date" in tables:
                selected["dim_date"] = tables["dim_date"]

        if not selected and "fact_sales" in tables:
            selected["fact_sales"] = tables["fact_sales"]

        return selected