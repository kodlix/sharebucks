import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.store import db


@pytest.fixture(autouse=True)
def reset_store():
    db.reset()
    yield
    db.reset()


@pytest.fixture()
def client():
    with TestClient(app) as tc:
        yield tc


def test_sqlalchemy_store_seed_and_collection_access():
    assert db.users.get("u1") is not None
    assert db.users.get("u1")["email"] == "demo@sharebucks.app"
    assert db.groups.get("g1") is not None
    assert db.groups.get("g1")["name"] == "Trip Crew"
    assert len(list(db.users.values())) >= 1


def test_register_and_me_round_trip(client):
    payload = {
        "email": "test@example.com",
        "password": "secret123",
        "display_name": "Test User",
    }

    register_resp = client.post("/api/auth/register", json=payload)
    assert register_resp.status_code == 200
    user = register_resp.json()
    assert user["email"] == payload["email"]
    assert user["display_name"] == payload["display_name"]

    me_resp = client.get("/api/auth/me")
    assert me_resp.status_code == 200
    me = me_resp.json()
    assert me["email"] == payload["email"]


def test_register_hashes_plain_password_before_storage(client):
    payload = {
        "email": "secure@example.com",
        "password": "secret123",
        "display_name": "Secure User",
    }

    register_resp = client.post("/api/auth/register", json=payload)
    assert register_resp.status_code == 200

    user = register_resp.json()
    stored = db.users.get(user["id"])
    assert stored is not None
    assert stored["password"] != payload["password"]
    assert stored["password"].startswith("pbkdf2_sha256$")

    login_resp = client.post("/api/auth/login", json=payload)
    assert login_resp.status_code == 200


def test_create_and_list_groups(client):
    client.post(
        "/api/auth/register",
        json={
            "email": "owner@example.com",
            "password": "secret123",
            "display_name": "Owner",
        },
    )

    payload = {
        "name": "Trip Crew",
        "description": "Summer trip",
        "visibility": "public",
        "currency": "USD",
    }

    create_resp = client.post("/api/groups", json=payload)
    assert create_resp.status_code == 200
    group = create_resp.json()
    assert group["name"] == payload["name"]
    assert group["visibility"] == payload["visibility"]

    list_resp = client.get("/api/groups")
    assert list_resp.status_code == 200
    groups = list_resp.json()
    assert len(groups) >= 1
    assert any(item["name"] == payload["name"] for item in groups)


def test_discover_groups_and_expenses(client):
    client.post(
        "/api/auth/register",
        json={
            "email": "owner2@example.com",
            "password": "secret123",
            "display_name": "Owner Two",
        },
    )

    discover_resp = client.get("/api/groups/discover?search=trip")
    assert discover_resp.status_code == 200
    discovered = discover_resp.json()
    assert isinstance(discovered, list)

    create_group_resp = client.post(
        "/api/groups",
        json={
            "name": "Dinner Club",
            "description": "Dinner",
            "visibility": "public",
            "currency": "USD",
        },
    )
    assert create_group_resp.status_code == 200
    group_id = create_group_resp.json()["id"]

    expense_resp = client.post(
        f"/api/groups/{group_id}/expenses",
        json={
            "title": "Dinner",
            "amount": 2500,
            "category_id": "cat-food",
            "payer_id": "u1",
            "expense_date": "2026-09-10",
            "notes": "Dinner receipt",
            "shares": [{"user_id": "u1", "amount": 2500}],
        },
    )
    assert expense_resp.status_code == 200
    expense = expense_resp.json()
    assert expense["title"] == "Dinner"

    expenses_resp = client.get(f"/api/groups/{group_id}/expenses")
    assert expenses_resp.status_code == 200
    expenses = expenses_resp.json()
    assert any(item["title"] == "Dinner" for item in expenses)


def test_balances_and_settlements_endpoints(client):
    client.post(
        "/api/auth/register",
        json={
            "email": "owner3@example.com",
            "password": "secret123",
            "display_name": "Owner Three",
        },
    )

    group_payload = {
        "name": "Balance Group",
        "description": "Settlement testing",
        "visibility": "public",
        "currency": "USD",
    }

    create_resp = client.post("/api/groups", json=group_payload)
    assert create_resp.status_code == 200
    group_id = create_resp.json()["id"]

    balances_resp = client.get(f"/api/groups/{group_id}/balances")
    assert balances_resp.status_code == 200
    balances = balances_resp.json()
    assert isinstance(balances, list)

    suggestions_resp = client.get(f"/api/groups/{group_id}/settlements/suggestions")
    assert suggestions_resp.status_code == 200
    suggestions = suggestions_resp.json()
    assert isinstance(suggestions, list)


def test_login_allows_browser_origin_for_vite_client(client):
    response = client.post(
        "/api/auth/login",
        json={"email": "demo@sharebucks.app", "password": "password123"},
        headers={"Origin": "http://localhost:8082"},
    )

    assert response.status_code == 200
    assert (
        response.headers.get("access-control-allow-origin") == "http://localhost:8082"
    )


def test_login_and_logout_endpoints(client):
    payload = {
        "email": "login@example.com",
        "password": "secret123",
    }

    client.post(
        "/api/auth/register",
        json={
            "email": payload["email"],
            "password": payload["password"],
            "display_name": "Login User",
        },
    )

    login_resp = client.post("/api/auth/login", json=payload)
    assert login_resp.status_code == 200

    logout_resp = client.post("/api/auth/logout")
    assert logout_resp.status_code == 204

    me_after_logout = client.get("/api/auth/me")
    assert me_after_logout.status_code == 200
    assert me_after_logout.json() is None
