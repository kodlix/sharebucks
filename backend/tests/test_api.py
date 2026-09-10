from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_register_and_me_round_trip():
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


def test_create_and_list_groups():
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


def test_discover_groups_and_expenses():
    discover_resp = client.get("/api/groups/discover?search=trip")
    assert discover_resp.status_code == 200
    discovered = discover_resp.json()
    assert isinstance(discovered, list)

    create_group_resp = client.post("/api/groups", json={
        "name": "Dinner Club",
        "description": "Dinner",
        "visibility": "public",
        "currency": "USD",
    })
    assert create_group_resp.status_code == 200
    group_id = create_group_resp.json()["id"]

    expense_resp = client.post(f"/api/groups/{group_id}/expenses", json={
        "title": "Dinner",
        "amount": 2500,
        "category_id": "cat-food",
        "payer_id": "u1",
        "expense_date": "2026-09-10",
        "notes": "Dinner receipt",
        "shares": [
            {"user_id": "u1", "amount": 2500}
        ],
    })
    assert expense_resp.status_code == 200
    expense = expense_resp.json()
    assert expense["title"] == "Dinner"

    expenses_resp = client.get(f"/api/groups/{group_id}/expenses")
    assert expenses_resp.status_code == 200
    expenses = expenses_resp.json()
    assert any(item["title"] == "Dinner" for item in expenses)


def test_balances_and_settlements_endpoints():
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


def test_login_and_logout_endpoints():
    payload = {
        "email": "login@example.com",
        "password": "secret123",
    }

    client.post("/api/auth/register", json={
        "email": payload["email"],
        "password": payload["password"],
        "display_name": "Login User",
    })

    login_resp = client.post("/api/auth/login", json=payload)
    assert login_resp.status_code == 200

    logout_resp = client.post("/api/auth/logout")
    assert logout_resp.status_code == 204
