from fastapi import FastAPI
import duckdb
import pandas as pd
from pathlib import Path

app = FastAPI()
# Kết nối tới DuckDB - bộ não xử lý file Parquet
db = duckdb.connect(':memory:')

@app.on_event("startup")
def setup_data():
    # Giả lập việc mount dữ liệu Silver (Amazon Books)
    # Trong thực tế, đây là bước ánh xạ tới Cloud Storage
    silver_parquet = Path("data/silver/books.parquet")
    if silver_parquet.exists():
        db.execute("CREATE VIEW silver_books AS SELECT * FROM 'data/silver/books.parquet'")
    else:
        # Keep the mock API available even when seed data has not been mounted yet.
        db.execute("CREATE TABLE silver_books (Title VARCHAR, Price DOUBLE)")

@app.get("/query")
def run_query(sql: str):
    """AI Agent sẽ gọi: http://localhost:8000/query?sql=SELECT..."""
    try:
        df = db.execute(sql).df()
        return df.to_dict(orient="records")
    except Exception as e:
        return {"error": str(e)}