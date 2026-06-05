"""Databricks SQL connector helpers for recommendation enrichment."""

from databricks import sql

from .config.databricks_config import (
    DATABRICKS_ACCESS_TOKEN,
    DATABRICKS_CATALOG,
    DATABRICKS_HOST,
    DATABRICKS_HTTP_PATH,
    DATABRICKS_SCHEMA,
)


def is_configured() -> bool:
    return bool(DATABRICKS_HOST and DATABRICKS_HTTP_PATH and DATABRICKS_ACCESS_TOKEN)


class DatabricksClient:
    def __init__(self):
        if not is_configured():
            raise RuntimeError("Databricks settings are missing.")

        self.conn = sql.connect(
            server_hostname=DATABRICKS_HOST,
            http_path=DATABRICKS_HTTP_PATH,
            access_token=DATABRICKS_ACCESS_TOKEN,
        )

        self._set_context()

    def _set_context(self) -> None:
        cursor = self.conn.cursor()
        if DATABRICKS_CATALOG:
            cursor.execute(f"USE CATALOG {DATABRICKS_CATALOG}")
        if DATABRICKS_SCHEMA:
            cursor.execute(f"USE SCHEMA {DATABRICKS_SCHEMA}")
        cursor.close()

    def query(self, sql_text: str) -> list[dict]:
        cursor = self.conn.cursor()
        cursor.execute(sql_text)

        rows = cursor.fetchall()
        cols = [c[0] for c in cursor.description]
        cursor.close()

        return [dict(zip(cols, row)) for row in rows]

    def close(self) -> None:
        if self.conn:
            self.conn.close()
