import os
import sys
from dotenv import load_dotenv

# Load .env.test từ project root bất kể pytest được gọi từ đâu
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env.test'))

# Thêm auth-service vào sys.path để import `app` như absolute package
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'services', 'auth-service'))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from app.db import Base, get_db
from app.main import app

TEST_DATABASE_URL = os.getenv("DATABASE_URL")

engine = create_engine(TEST_DATABASE_URL, pool_pre_ping=True)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


def pytest_sessionstart(session):
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def pytest_sessionfinish(session, exitstatus):
    Base.metadata.drop_all(bind=engine)


app.dependency_overrides[get_db] = override_get_db


import pytest


@pytest.fixture()
def client():
    # Xóa sạch data trước mỗi test để tránh conflict (unique constraint)
    for table in reversed(Base.metadata.sorted_tables):
        with engine.begin() as conn:
            conn.execute(table.delete())

    with TestClient(app) as c:
        yield c