from __future__ import annotations

FORBIDDEN = [
    "INSERT", "UPDATE", "DELETE", "DROP", "ALTER",
    "TRUNCATE", "MERGE", "COPY", "GRANT", "REVOKE"
]


def validate_sql(sql: str, allowed_tables: set[str]) -> str:
    normalized = " ".join(sql.strip().split())
    upper = normalized.upper()

    if not (upper.startswith("SELECT") or upper.startswith("WITH")):
        raise ValueError("Only SELECT/WITH queries are allowed.")

    for keyword in FORBIDDEN:
        if keyword in upper:
            raise ValueError(f"Forbidden keyword detected: {keyword}")

    # Check table allowlist by simple containment first.
    # Can upgrade later with sqlglot parser.
    lower = normalized.lower()
    if not any(tbl.lower() in lower for tbl in allowed_tables):
        raise ValueError("Query does not reference any allowed table.")

    return normalized