from __future__ import annotations

from app.agent.nodes.build_visualization import build_visualization_node
from app.agent.state import (
    AgentState,
    AnalysisPlan,
    MetricSpec,
    QueryResult,
)


def _state_with_result(
    *,
    question: str,
    dimensions: list[str],
    metrics: list[str],
    rows: list[dict],
    row_count: int | None = None,
) -> AgentState:
    return AgentState(
        session_id="test-session",
        question=question,
        relevant_schema={},
        analysis_plan=AnalysisPlan(
            goal=question,
            fact_table="fact_sales",
            joins=[],
            dimensions=dimensions,
            metrics=[MetricSpec(name=metric, expression=metric, alias=metric) for metric in metrics],
            filters=[],
            order_by=[],
            limit=None,
            group_by=dimensions,
            comparison=None,
            notes=[],
        ),
        query_result=QueryResult(
            columns=list(rows[0].keys()),
            rows=rows,
            row_count=row_count if row_count is not None else len(rows),
            execution_ms=25,
        ),
    )


def test_build_visualization_line_chart_for_time_series():
    state = _state_with_result(
        question="Doanh thu theo thang",
        dimensions=["order_month"],
        metrics=["revenue"],
        rows=[
            {"order_month": "2026-01-01", "revenue": 1200.0},
            {"order_month": "2026-02-01", "revenue": 1400.0},
            {"order_month": "2026-03-01", "revenue": 1350.0},
        ],
    )

    result = build_visualization_node(state)

    assert result["visualization"] is not None
    assert result["visualization"].kind == "line"
    assert result["visualization"].x_key == "order_month"
    assert result["visualization"].series[0].key == "revenue"


def test_build_visualization_bar_chart_for_large_categorical_breakdown():
    rows = [{"category_name": f"Category {index}", "total_sales": float(index * 10)} for index in range(1, 10)]
    state = _state_with_result(
        question="Top category",
        dimensions=["category_name"],
        metrics=["total_sales"],
        rows=rows,
    )

    result = build_visualization_node(state)

    assert result["visualization"] is not None
    assert result["visualization"].kind == "bar"
    assert result["visualization"].truncated is False


def test_build_visualization_pie_chart_for_small_categorical_breakdown():
    state = _state_with_result(
        question="Ty trong doanh thu theo danh muc",
        dimensions=["category_name"],
        metrics=["total_sales"],
        rows=[
            {"category_name": "Van hoc", "total_sales": 300.0},
            {"category_name": "Kinh te", "total_sales": 240.0},
            {"category_name": "Ky nang", "total_sales": 120.0},
        ],
    )

    result = build_visualization_node(state)

    assert result["visualization"] is not None
    assert result["visualization"].kind == "pie"
    assert result["visualization"].series[0].key == "total_sales"


def test_build_visualization_skips_when_result_is_partial_preview():
    state = _state_with_result(
        question="Doanh thu theo thang",
        dimensions=["order_month"],
        metrics=["revenue"],
        rows=[
            {"order_month": "2026-01-01", "revenue": 1200.0},
            {"order_month": "2026-02-01", "revenue": 1400.0},
        ],
        row_count=12,
    )

    result = build_visualization_node(state)

    assert result["visualization"] is None


def test_build_visualization_skips_when_many_metrics_or_dimensions():
    state = _state_with_result(
        question="Bang tong hop",
        dimensions=["category_name", "seller_name"],
        metrics=["revenue", "orders", "buyers"],
        rows=[
            {
                "category_name": "Van hoc",
                "seller_name": "A",
                "revenue": 1000.0,
                "orders": 5.0,
                "buyers": 4.0,
            }
        ],
    )

    result = build_visualization_node(state)

    assert result["visualization"] is None


def test_build_visualization_allows_multiple_plan_dimensions_when_only_one_varies_in_result():
    state = _state_with_result(
        question="So luong don theo thang cua tiem co doanh thu cao nhat",
        dimensions=["seller_name", "order_month"],
        metrics=["orders"],
        rows=[
            {"seller_name": "Tiem A", "order_month": "2025-01-01", "orders": 31.0},
            {"seller_name": "Tiem A", "order_month": "2025-02-01", "orders": 45.0},
            {"seller_name": "Tiem A", "order_month": "2025-03-01", "orders": 42.0},
        ],
    )

    result = build_visualization_node(state)

    assert result["visualization"] is not None
    assert result["visualization"].kind == "line"
    assert result["visualization"].x_key == "order_month"
