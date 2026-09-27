"""
Smoke tests for the auth surface of the gateway.

These exercise the exact flow that broke in production before this
codebase was fixed: user registration, login, and profile retrieval all
used to crash with a 500 due to a preferences (de)serialization bug, and
the app couldn't even boot due to a broken UserRole enum. Run with:

    cd apps/api && pytest
"""
import os
import uuid

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_ci.db?check_same_thread=false")
os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379")
os.environ.setdefault("SHIVRA_API_URL", "http://localhost:8000")
os.environ.setdefault("SKIP_SEED_ADMIN", "true")

import pytest
from fastapi.testclient import TestClient

from src.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def _unique_email() -> str:
    return f"test-{uuid.uuid4().hex[:10]}@example.com"


def test_health(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_register_returns_valid_user(client):
    email = _unique_email()
    resp = client.post(
        "/api/auth/register",
        json={"username": "tester", "email": email, "password": "Passw0rd!"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["email"] == email
    assert body["preferences"] == {}


def test_login_then_me(client):
    email = _unique_email()
    client.post(
        "/api/auth/register",
        json={"username": "tester2", "email": email, "password": "Passw0rd!"},
    )
    login_resp = client.post(
        "/api/auth/login", json={"email": email, "password": "Passw0rd!"}
    )
    assert login_resp.status_code == 200, login_resp.text
    token = login_resp.json()["access_token"]

    me_resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_resp.status_code == 200, me_resp.text
    assert me_resp.json()["email"] == email


def test_login_with_wrong_password_is_clean_401(client):
    email = _unique_email()
    client.post(
        "/api/auth/register",
        json={"username": "tester3", "email": email, "password": "Passw0rd!"},
    )
    resp = client.post("/api/auth/login", json={"email": email, "password": "wrong"})
    assert resp.status_code == 401
