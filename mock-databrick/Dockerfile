FROM python:3.11-slim

WORKDIR /app/mock-databrick

# Keep image small and avoid buffering logs in containers.
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Runtime dependencies for the mock Databricks API.
RUN pip install --no-cache-dir fastapi uvicorn duckdb pandas pyarrow

COPY app ./app
COPY data ./data

EXPOSE 8081

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8081"]
