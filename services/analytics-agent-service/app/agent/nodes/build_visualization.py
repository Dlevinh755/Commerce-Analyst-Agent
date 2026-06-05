from __future__ import annotations

from datetime import date, datetime
from numbers import Real
from typing import Any

from dateutil import parser as date_parser

try:
    from langgraph.config import get_stream_writer
except ImportError:  # pragma: no cover - local test fallback when langgraph is unavailable
    def get_stream_writer():
        raise RuntimeError("langgraph is unavailable")

from app.agent.state import AgentState, QueryResult, VisualizationSeries, VisualizationSpec

MAX_CHART_POINTS = 20
MAX_PIE_POINTS = 8
TIME_NAME_HINTS = ("date", "time", "day", "week", "month", "quarter", "year")


def _safe_stream_writer():
    try:
        return get_stream_writer()
    except RuntimeError:
        return lambda _event: None


def _labelize(value: str) -> str:
    return value.replace("_", " ").strip().title()


def _normalize_key(value: str) -> str:
    return value.strip().lower()


def _is_numeric_value(value: Any) -> bool:
    return isinstance(value, Real) and not isinstance(value, bool)


def _is_time_value(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, datetime):
        return True
    if isinstance(value, date):
        return True
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return False
        if any(char.isdigit() for char in text) and any(sep in text for sep in ("-", "/", ":")):
            try:
                date_parser.parse(text)
                return True
            except (ValueError, TypeError, OverflowError):
                return False
    return False


def _to_chart_value(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return value


def _time_sort_key(value: Any) -> tuple[int, Any]:
    if value is None:
        return (1, "")
    if isinstance(value, datetime):
        return (0, value)
    if isinstance(value, date):
        return (0, datetime.combine(value, datetime.min.time()))
    if isinstance(value, str):
        text = value.strip()
        if text:
            try:
                return (0, date_parser.parse(text))
            except (ValueError, TypeError, OverflowError):
                return (0, text)
    return (0, value)


def _column_non_null_values(rows: list[dict[str, Any]], column: str) -> list[Any]:
    return [row.get(column) for row in rows if row.get(column) is not None]


def _is_numeric_column(rows: list[dict[str, Any]], column: str) -> bool:
    values = _column_non_null_values(rows, column)
    return bool(values) and all(_is_numeric_value(value) for value in values)


def _is_constant_column(rows: list[dict[str, Any]], column: str) -> bool:
    values = _column_non_null_values(rows, column)
    if not values:
        return True
    first = values[0]
    return all(value == first for value in values[1:])


def _is_time_column(rows: list[dict[str, Any]], column: str) -> bool:
    values = _column_non_null_values(rows, column)
    if not values:
        return False

    normalized_name = _normalize_key(column)
    if any(hint in normalized_name for hint in TIME_NAME_HINTS):
        return True

    time_like_count = sum(1 for value in values if _is_time_value(value))
    return time_like_count == len(values)


def _match_column(candidates: list[str], columns: list[str]) -> str | None:
    column_map = {_normalize_key(column): column for column in columns}
    for candidate in candidates:
        if not candidate:
            continue
        matched = column_map.get(_normalize_key(candidate))
        if matched:
            return matched
    return None


def _pick_dimension_column(state: AgentState, result: QueryResult) -> tuple[str | None, str | None]:
    columns = list(result.columns)
    non_numeric_columns = [column for column in columns if not _is_numeric_column(result.rows, column)]

    if state.analysis_plan and state.analysis_plan.dimensions:
        matched_dimensions: list[str] = []
        for dimension in state.analysis_plan.dimensions:
            matched = _match_column([dimension], columns)
            if matched and matched not in matched_dimensions:
                matched_dimensions.append(matched)

        varying_dimensions = [column for column in matched_dimensions if not _is_constant_column(result.rows, column)]
        if len(varying_dimensions) == 1:
            return varying_dimensions[0], None

        if len(matched_dimensions) == 1:
            return matched_dimensions[0], None

        if len(varying_dimensions) > 1:
            time_varying_dimensions = [column for column in varying_dimensions if _is_time_column(result.rows, column)]
            if len(time_varying_dimensions) == 1:
                return time_varying_dimensions[0], None

            non_numeric_varying = [column for column in non_numeric_columns if column in varying_dimensions]
            if len(non_numeric_varying) == 1:
                return non_numeric_varying[0], None
            return None, "multiple_dimensions"

    time_columns = [column for column in non_numeric_columns if _is_time_column(result.rows, column)]
    if len(time_columns) == 1:
        return time_columns[0], None

    if len(non_numeric_columns) == 1:
        return non_numeric_columns[0], None

    return None, "missing_single_dimension"


def _pick_metric_columns(state: AgentState, result: QueryResult, x_key: str) -> tuple[list[str], str | None]:
    columns = [column for column in result.columns if column != x_key]
    numeric_columns = [column for column in columns if _is_numeric_column(result.rows, column)]

    if state.analysis_plan and len(state.analysis_plan.metrics) > 2:
        return [], "too_many_metrics"

    preferred_candidates: list[str] = []
    if state.analysis_plan:
        for metric in state.analysis_plan.metrics:
            preferred_candidates.extend([metric.alias, metric.name])

    selected: list[str] = []
    for candidate in preferred_candidates:
        matched = _match_column([candidate], numeric_columns)
        if matched and matched not in selected:
            selected.append(matched)

    if not selected:
        selected = list(numeric_columns)

    if not selected:
        return [], "missing_numeric_metric"

    if len(selected) > 2:
        return [], "too_many_metrics"

    return selected, None


def _build_dataset(rows: list[dict[str, Any]], x_key: str, metric_columns: list[str]) -> list[dict[str, Any]]:
    dataset: list[dict[str, Any]] = []
    for row in rows:
        x_value = row.get(x_key)
        if x_value is None:
            continue

        item: dict[str, Any] = {x_key: _to_chart_value(x_value)}
        metric_found = False
        for metric_column in metric_columns:
            value = row.get(metric_column)
            if value is None:
                continue
            if not _is_numeric_value(value):
                return []
            item[metric_column] = float(value)
            metric_found = True

        if metric_found:
            dataset.append(item)

    return dataset


def _sort_dataset(
    dataset: list[dict[str, Any]],
    *,
    x_key: str,
    is_time_dimension: bool,
) -> list[dict[str, Any]]:
    if len(dataset) <= 1:
        return dataset

    if is_time_dimension:
        return sorted(dataset, key=lambda item: _time_sort_key(item.get(x_key)))

    return dataset


def _skip_payload(reason: str) -> dict[str, Any]:
    return {
        "reason": reason,
        "kind": None,
    }


def build_visualization_node(state: AgentState) -> dict[str, Any]:
    writer = _safe_stream_writer()
    writer({
        "type": "step_start",
        "step": "build_visualization",
        "message": "Dang xay dung visualization",
    })

    if state.execution_error or state.query_result is None:
        writer({
            "type": "step_end",
            "step": "build_visualization",
            "message": "Bo qua visualization",
            "payload": _skip_payload("query_result_unavailable"),
        })
        return {"visualization": None}

    result = state.query_result
    if result.row_count > len(result.rows):
        writer({
            "type": "step_end",
            "step": "build_visualization",
            "message": "Bo qua visualization",
            "payload": _skip_payload("partial_preview"),
        })
        return {"visualization": None}

    if len(result.columns) < 2 or not result.rows:
        writer({
            "type": "step_end",
            "step": "build_visualization",
            "message": "Bo qua visualization",
            "payload": _skip_payload("insufficient_columns"),
        })
        return {"visualization": None}

    x_key, dimension_error = _pick_dimension_column(state, result)
    if not x_key:
        writer({
            "type": "step_end",
            "step": "build_visualization",
            "message": "Bo qua visualization",
            "payload": _skip_payload(dimension_error or "missing_single_dimension"),
        })
        return {"visualization": None}

    metric_columns, metric_error = _pick_metric_columns(state, result, x_key)
    if not metric_columns:
        writer({
            "type": "step_end",
            "step": "build_visualization",
            "message": "Bo qua visualization",
            "payload": _skip_payload(metric_error or "missing_numeric_metric"),
        })
        return {"visualization": None}

    dataset = _build_dataset(result.rows, x_key, metric_columns)
    if not dataset:
        writer({
            "type": "step_end",
            "step": "build_visualization",
            "message": "Bo qua visualization",
            "payload": _skip_payload("invalid_dataset"),
        })
        return {"visualization": None}

    is_time_dimension = _is_time_column(result.rows, x_key)
    dataset = _sort_dataset(
        dataset,
        x_key=x_key,
        is_time_dimension=is_time_dimension,
    )
    chart_kind = "line" if is_time_dimension else "bar"

    if not is_time_dimension and len(metric_columns) == 1:
        metric_key = metric_columns[0]
        metric_values = [item.get(metric_key, 0) for item in dataset]
        if len(dataset) <= MAX_PIE_POINTS and all(value >= 0 for value in metric_values):
            chart_kind = "pie"

    max_points = MAX_PIE_POINTS if chart_kind == "pie" else MAX_CHART_POINTS
    truncated = len(dataset) > max_points
    if truncated:
        dataset = dataset[:max_points]

    visualization = VisualizationSpec(
        kind=chart_kind,
        title=state.question,
        description=(
            "Tu dong tao tu query result" + (" (da cat bot)" if truncated else "")
        ),
        x_key=x_key,
        series=[VisualizationSeries(key=metric, label=_labelize(metric)) for metric in metric_columns],
        dataset=dataset,
        x_label=_labelize(x_key),
        y_label=", ".join(_labelize(metric) for metric in metric_columns),
        truncated=truncated,
        reason=None,
    )

    writer({
        "type": "step_end",
        "step": "build_visualization",
        "message": "Da hoan thanh build_visualization",
        "payload": {
            "kind": visualization.kind,
            "x_key": visualization.x_key,
            "series": [series.model_dump() for series in visualization.series],
            "truncated": visualization.truncated,
        },
    })
    return {"visualization": visualization}
