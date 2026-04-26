from databricks import sql
from ..config import settings
import pandas as pd


class DatabricksClient:
    def __init__(self):
        self.conn = sql.connect(
            server_hostname=settings.DATABRICKS_HOST,
            http_path=settings.DATABRICKS_HTTP_PATH,
            access_token=settings.DATABRICKS_TOKEN,
        )

        self._set_context()

    def _set_context(self):
        cursor = self.conn.cursor()

        cursor.execute(f"USE CATALOG {settings.DATABRICKS_CATALOG_NAME}")
        cursor.execute(f"USE SCHEMA {settings.DATABRICKS_SCHEMA_NAME}")

        cursor.close()

    def query(self, sql_text: str):
        cursor = self.conn.cursor()
        cursor.execute(sql_text)

        rows = cursor.fetchall()
        cols = [c[0] for c in cursor.description]

        cursor.close()

        return pd.DataFrame(rows, columns=cols)
    def close(self):
        if self.conn:
            self.conn.close()