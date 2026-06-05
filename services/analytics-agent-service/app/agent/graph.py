from __future__ import annotations

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import StateGraph, START, END

from app.agent.state import AgentState
from app.agent.nodes.parse_intent import parse_intent_node
from app.agent.nodes.retrieve_schema import retrieve_schema_node
from app.agent.nodes.build_analysis_plan import build_analysis_plan_node
from app.agent.nodes.generate_sql import generate_sql_node
from app.agent.nodes.validate_sql import validate_sql_node
from app.agent.nodes.execute_sql import execute_sql_node
from app.agent.nodes.build_visualization import build_visualization_node
from app.agent.nodes.analyze_result import analyze_result_node
from app.agent.nodes.update_memory import update_memory_node
from app.agent.nodes.repair_sql import repair_sql_node

def should_repair_or_continue(state: AgentState) -> str:
    if state.execution_error and state.repair_attempts < state.max_repair_attempts:
        return "repair_sql"

    if state.execution_error:
        return "analyze_result"

    return "build_visualization"


def build_graph():
    builder = StateGraph(AgentState)

    builder.add_node("parse_intent", parse_intent_node)
    builder.add_node("retrieve_schema", retrieve_schema_node)
    builder.add_node("build_analysis_plan", build_analysis_plan_node)
    builder.add_node("generate_sql", generate_sql_node)
    builder.add_node("validate_sql", validate_sql_node)
    builder.add_node("execute_sql", execute_sql_node)
    builder.add_node("repair_sql", repair_sql_node)
    builder.add_node("build_visualization", build_visualization_node)
    builder.add_node("analyze_result", analyze_result_node)
    builder.add_node("update_memory", update_memory_node)

    builder.add_edge(START, "parse_intent")
    builder.add_edge("parse_intent", "retrieve_schema")
    builder.add_edge("retrieve_schema", "build_analysis_plan")
    builder.add_edge("build_analysis_plan", "generate_sql")
    builder.add_edge("generate_sql", "validate_sql")
    builder.add_edge("validate_sql", "execute_sql")

    builder.add_conditional_edges(
        "execute_sql",
        should_repair_or_continue,
        {
            "repair_sql": "repair_sql",
            "build_visualization": "build_visualization",
            "analyze_result": "analyze_result",
        },
    )

    builder.add_edge("repair_sql", "validate_sql")
    builder.add_edge("build_visualization", "analyze_result")
    builder.add_edge("analyze_result", "update_memory")
    builder.add_edge("update_memory", END)

    return builder.compile(checkpointer=MemorySaver())
