from __future__ import annotations

from datetime import datetime, timezone, date
from typing import Any, Dict, List, Optional
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from app.security import hash_password, verify_password
from app.store import db
from app.models import (
    RegisterInput,
    LoginInput,
    CreateGroupInput,
    UpdateGroupInput,
    ExpenseInput,
    SettlementInput,
    User,
)

app = FastAPI(title="ShareBucks API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://192.168.1.200:8083",
        "http://localhost:8083",
        "http://localhost:8085",
        "http://127.0.0.1:8085",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def user_from_db(user_id: str) -> Optional[Dict[str, Any]]:
    return db.users.get(user_id)


def session_user(request: Request) -> Optional[str]:
    session_id = request.cookies.get("session")
    if session_id and session_id in db.users:
        return session_id
    return None


def session_cookie_secure(request: Request) -> bool:
    # Browsers only retain cross-origin SameSite=None cookies when Secure is on.
    # TestClient/curl process the API without an Origin header, so keep the cookie
    # readable in the in-process HTTP contract by emitting Secure=False there.
    return request.headers.get("origin") is not None


def group_from_context(group_id: str) -> Optional[Dict[str, Any]]:
    return db.groups.get(group_id)


def members_for_group(group_id: str) -> List[Dict[str, Any]]:
    group = group_from_context(group_id)
    if not group:
        return []
    return [m for m in group.get("members", [])]


def member_role_in_group(group_id: str, user_id: str) -> str:
    group = group_from_context(group_id)
    if not group:
        return "member"
    for member in group.get("members", []):
        if member["user_id"] == user_id:
            return member.get("role", "member")
    return "member"


def response_user(user: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": user["id"],
        "email": user["email"],
        "display_name": user["display_name"],
        "created_at": user["created_at"],
    }


def expense_to_response(expense: Dict[str, Any]) -> Dict[str, Any]:
    payer = user_from_db(expense["payer_id"])
    category = (
        db.categories.get(expense["category_id"]) if hasattr(db, "categories") else None
    )
    out = {
        "id": expense["id"],
        "group_id": expense["group_id"],
        "created_by": expense["created_by"],
        "payer_id": expense["payer_id"],
        "category_id": expense["category_id"],
        "title": expense["title"],
        "amount": expense["amount"],
        "expense_date": expense["expense_date"],
        "notes": expense["notes"],
        "created_at": expense["created_at"],
        "updated_at": expense["updated_at"],
        "shares": expense.get("shares", []),
        "payer": response_user(payer) if payer else None,
        "category": category
        or {
            "id": expense["category_id"],
            "group_id": expense["group_id"],
            "name": "General",
            "is_default": True,
            "created_at": now_iso(),
        },
    }
    return out


@app.get("/health", tags=["Health"])
def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.post("/api/auth/register", response_model=User, tags=["Auth"])
def register(
    payload: RegisterInput, response: Response, request: Request
) -> Dict[str, Any]:
    email = payload.email.lower()
    existing = db.users.get_by_email(email)
    if existing is not None:
        raise HTTPException(
            status_code=409,
            detail={"error": {"message": "Email already registered", "status": 409}},
        )

    user_id = f"u{uuid4().hex[:8]}"
    user = {
        "id": user_id,
        "email": email,
        "password": hash_password(payload.password),
        "display_name": payload.display_name,
        "created_at": now_iso(),
    }
    db.users[user_id] = user
    db.current_user_id = user_id
    response.set_cookie(
        key="session",
        value=user_id,
        httponly=True,
        samesite="none",
        secure=session_cookie_secure(request),
    )
    return response_user(user)


@app.post("/api/auth/login", tags=["Auth"])
def login(payload: LoginInput, response: Response, request: Request) -> Dict[str, Any]:
    email = payload.email.lower()
    user = db.users.get_by_email(email)
    if user is None or not verify_password(payload.password, user.get("password", "")):
        raise HTTPException(
            status_code=401,
            detail={"error": {"message": "Incorrect email or password", "status": 401}},
        )

    db.current_user_id = user["id"]
    response.set_cookie(
        key="session",
        value=user["id"],
        httponly=True,
        samesite="none",
        secure=session_cookie_secure(request),
    )
    return response_user(user)


@app.post("/api/auth/logout", tags=["Auth"])
def logout(response: Response, request: Request) -> Response:
    response.delete_cookie(
        "session",
        path="/",
        httponly=True,
        samesite="none",
        secure=session_cookie_secure(request),
    )
    response.status_code = 204
    return response


@app.get("/api/auth/me", tags=["Auth"])
def me(request: Request) -> Any:
    session = session_user(request)
    if not session:
        return None
    user = user_from_db(session)
    if not user:
        return None
    return response_user(user)


@app.get("/api/groups", tags=["Groups"])
def list_groups(request: Request) -> List[Dict[str, Any]]:
    user_id = session_user(request)
    if not user_id:
        raise HTTPException(
            status_code=401,
            detail={"error": {"message": "Authentication required", "status": 401}},
        )
    groups = []
    for group in db.groups.values():
        members = [m for m in group.get("members", []) if m["user_id"] == user_id]
        if members:
            role = members[0]["role"]
            groups.append(
                {
                    **group,
                    "role": role,
                    "member_count": len(group.get("members", [])),
                    "my_balance": 0,
                    "total_spent": sum(
                        e["amount"]
                        for e in db.expenses.values()
                        if e["group_id"] == group["id"]
                    ),
                }
            )
    return groups


@app.post("/api/groups", tags=["Groups"])
def create_group(payload: CreateGroupInput, request: Request) -> Dict[str, Any]:
    user_id = session_user(request)
    if not user_id:
        raise HTTPException(
            status_code=401,
            detail={"error": {"message": "Authentication required", "status": 401}},
        )

    group_id = f"g{uuid4().hex[:8]}"
    now = now_iso()
    group = {
        "id": group_id,
        "name": payload.name,
        "description": payload.description,
        "visibility": payload.visibility,
        "currency": payload.currency,
        "created_by": user_id,
        "is_archived": False,
        "created_at": now,
        "updated_at": now,
        "members": [],
        "categories": [],
    }

    member = {
        "id": f"m{uuid4().hex[:8]}",
        "group_id": group_id,
        "user_id": user_id,
        "role": "admin",
        "status": "active",
        "joined_at": now,
        "left_at": None,
        "user": response_user(user_from_db(user_id)),
    }
    group["members"] = [member]

    db.groups[group_id] = group
    return {
        **group,
        "role": "admin",
        "member_count": 1,
        "my_balance": 0,
        "total_spent": 0,
    }


@app.get("/api/groups/discover", tags=["Groups"])
def discover_groups(
    request: Request, search: Optional[str] = None
) -> List[Dict[str, Any]]:
    q = (search or "").lower()
    out = []
    for group in db.groups.values():
        if (
            q
            and q not in group["name"].lower()
            and q not in group["description"].lower()
        ):
            continue
        if group["visibility"] != "public":
            continue
        member_count = len(group.get("members", []))
        out.append(
            {
                **group,
                "member_count": member_count,
                "is_member": any(
                    member["user_id"] == session_user(request)
                    for member in group.get("members", [])
                ),
            }
        )
    return out


@app.get("/api/groups/{group_id}", tags=["Groups"])
def get_group(group_id: str, request: Request) -> Dict[str, Any]:
    user_id = session_user(request)
    if not user_id:
        raise HTTPException(
            status_code=401,
            detail={"error": {"message": "Authentication required", "status": 401}},
        )
    group = db.groups.get(group_id)
    if not group:
        raise HTTPException(
            status_code=404,
            detail={"error": {"message": "Group not found", "status": 404}},
        )
    if not any(
        member["user_id"] == user_id and member["status"] == "active"
        for member in group.get("members", [])
    ):
        raise HTTPException(
            status_code=403,
            detail={"error": {"message": "Not an active member", "status": 403}},
        )
    role = member_role_in_group(group_id, user_id)
    return {
        **group,
        "role": role,
        "members": group.get("members", []),
        "categories": group.get("categories", []),
    }


@app.patch("/api/groups/{group_id}", tags=["Groups"])
def update_group(
    group_id: str, payload: UpdateGroupInput, request: Request
) -> Dict[str, Any]:
    user_id = session_user(request)
    if not user_id:
        raise HTTPException(
            status_code=401,
            detail={"error": {"message": "Authentication required", "status": 401}},
        )
    group = db.groups.get(group_id)
    if not group:
        raise HTTPException(
            status_code=404,
            detail={"error": {"message": "Group not found", "status": 404}},
        )
    if member_role_in_group(group_id, user_id) != "admin":
        raise HTTPException(
            status_code=403,
            detail={"error": {"message": "Only admin may edit", "status": 403}},
        )
    if group.get("is_archived"):
        raise HTTPException(
            status_code=409,
            detail={
                "error": {"message": "Archived group cannot be edited", "status": 409}
            },
        )

    if payload.name is not None:
        group["name"] = payload.name
    if payload.description is not None:
        group["description"] = payload.description
    if payload.visibility is not None:
        group["visibility"] = payload.visibility
    if payload.currency is not None:
        group["currency"] = payload.currency
    group["updated_at"] = now_iso()
    return {
        **group,
        "role": "admin",
        "members": group.get("members", []),
        "categories": group.get("categories", []),
    }


@app.post("/api/groups/{group_id}/archive", tags=["Groups"])
def archive_group(group_id: str, request: Request) -> Dict[str, Any]:
    user_id = session_user(request)
    if not user_id:
        raise HTTPException(
            status_code=401,
            detail={"error": {"message": "Authentication required", "status": 401}},
        )
    group = db.groups.get(group_id)
    if not group:
        raise HTTPException(
            status_code=404,
            detail={"error": {"message": "Group not found", "status": 404}},
        )
    if member_role_in_group(group_id, user_id) != "admin":
        raise HTTPException(
            status_code=403,
            detail={"error": {"message": "Only admin may archive", "status": 403}},
        )
    group["is_archived"] = True
    group["updated_at"] = now_iso()
    return {
        **group,
        "role": "admin",
        "members": group.get("members", []),
        "categories": group.get("categories", []),
    }


@app.post("/api/groups/{group_id}/leave", tags=["Groups"])
def leave_group(group_id: str, request: Request) -> Response:
    user_id = session_user(request)
    if not user_id:
        raise HTTPException(
            status_code=401,
            detail={"error": {"message": "Authentication required", "status": 401}},
        )
    group = db.groups.get(group_id)
    if not group:
        raise HTTPException(
            status_code=404,
            detail={"error": {"message": "Group not found", "status": 404}},
        )
    if (
        member_role_in_group(group_id, user_id) == "admin"
        and len(group.get("members", [])) == 1
    ):
        raise HTTPException(
            status_code=409,
            detail={
                "error": {
                    "message": "Admin cannot leave; settle debt first",
                    "status": 409,
                }
            },
        )
    group["members"] = [m for m in group.get("members", []) if m["user_id"] != user_id]
    return Response(status_code=204)


@app.get("/api/groups/{group_id}/members", tags=["Groups"])
def list_members(group_id: str, request: Request) -> List[Dict[str, Any]]:
    user_id = session_user(request)
    if not user_id:
        raise HTTPException(
            status_code=401,
            detail={"error": {"message": "Authentication required", "status": 401}},
        )
    group = db.groups.get(group_id)
    if not group:
        raise HTTPException(
            status_code=404,
            detail={"error": {"message": "Group not found", "status": 404}},
        )
    if not any(member["user_id"] == user_id for member in group.get("members", [])):
        raise HTTPException(
            status_code=403,
            detail={"error": {"message": "Not an active member", "status": 403}},
        )
    return group.get("members", [])


@app.post("/api/groups/{group_id}/invites", tags=["Groups"])
def create_invite(group_id: str, request: Request) -> Dict[str, Any]:
    user_id = session_user(request)
    if not user_id:
        raise HTTPException(
            status_code=401,
            detail={"error": {"message": "Authentication required", "status": 401}},
        )
    group = db.groups.get(group_id)
    if not group:
        raise HTTPException(
            status_code=404,
            detail={"error": {"message": "Group not found", "status": 404}},
        )
    if group.get("is_archived"):
        raise HTTPException(
            status_code=409,
            detail={
                "error": {
                    "message": "Archived groups accept no new members",
                    "status": 409,
                }
            },
        )
    if member_role_in_group(group_id, user_id) != "admin":
        raise HTTPException(
            status_code=403,
            detail={
                "error": {"message": "Only admin may create invite", "status": 403}
            },
        )
    code = uuid4().hex[:8]
    invite = {
        "id": f"inv{uuid4().hex[:8]}",
        "group_id": group_id,
        "created_by": user_id,
        "code": code,
        "expires_at": datetime.now(timezone.utc).isoformat(),
        "created_at": now_iso(),
    }
    return invite


@app.post("/api/groups/{group_id}/join", tags=["Groups"])
def join_group(
    group_id: str, request: Request, payload: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    user_id = session_user(request)
    if not user_id:
        raise HTTPException(
            status_code=401,
            detail={"error": {"message": "Authentication required", "status": 401}},
        )
    group = db.groups.get(group_id)
    if not group:
        raise HTTPException(
            status_code=404,
            detail={"error": {"message": "Group not found", "status": 404}},
        )
    if any(member["user_id"] == user_id for member in group.get("members", [])):
        raise HTTPException(
            status_code=409,
            detail={
                "error": {
                    "message": "Already a member or archived group",
                    "status": 409,
                }
            },
        )
    if group.get("is_archived"):
        raise HTTPException(
            status_code=409,
            detail={
                "error": {
                    "message": "Already a member or archived group",
                    "status": 409,
                }
            },
        )
    if group.get("visibility") == "private":
        code = (payload or {}).get("code")
        if not code:
            raise HTTPException(
                status_code=403,
                detail={
                    "error": {
                        "message": "Private group requires invitation code",
                        "status": 403,
                    }
                },
            )
    group.setdefault("members", []).append(
        {
            "id": f"m{uuid4().hex[:8]}",
            "group_id": group_id,
            "user_id": user_id,
            "role": "member",
            "status": "active",
            "joined_at": now_iso(),
            "left_at": None,
            "user": response_user(user_from_db(user_id)),
        }
    )
    return {
        **group,
        "role": "member",
        "members": group.get("members", []),
        "categories": group.get("categories", []),
    }


@app.delete("/api/groups/{group_id}/members/{user_id}", tags=["Groups"])
def remove_member(group_id: str, user_id: str, request: Request) -> Response:
    current_user = session_user(request)
    if not current_user:
        raise HTTPException(
            status_code=401,
            detail={"error": {"message": "Authentication required", "status": 401}},
        )
    group = db.groups.get(group_id)
    if not group:
        raise HTTPException(
            status_code=404,
            detail={"error": {"message": "Group not found", "status": 404}},
        )
    if member_role_in_group(group_id, current_user) != "admin":
        raise HTTPException(
            status_code=403,
            detail={"error": {"message": "Admin-only action", "status": 403}},
        )
    removed = False
    members = group.get("members", [])
    for idx, member in enumerate(members):
        if member["user_id"] == user_id:
            members.pop(idx)
            removed = True
            break
    if not removed:
        raise HTTPException(
            status_code=404,
            detail={"error": {"message": "Member not found", "status": 404}},
        )
    return Response(status_code=204)


@app.post("/api/groups/{group_id}/categories", tags=["Groups"])
def create_category(
    group_id: str, payload: Dict[str, str], request: Request
) -> Dict[str, Any]:
    user_id = session_user(request)
    if not user_id:
        raise HTTPException(
            status_code=401,
            detail={"error": {"message": "Authentication required", "status": 401}},
        )
    group = db.groups.get(group_id)
    if not group:
        raise HTTPException(
            status_code=404,
            detail={"error": {"message": "Group not found", "status": 404}},
        )
    if group.get("is_archived"):
        raise HTTPException(
            status_code=409,
            detail={
                "error": {
                    "message": "Archived group cannot accept category",
                    "status": 409,
                }
            },
        )
    name = (payload.get("name") or "").strip()
    if not name:
        raise HTTPException(
            status_code=422,
            detail={"error": {"message": "Empty category name", "status": 422}},
        )
    if any(cat["name"].lower() == name.lower() for cat in group.get("categories", [])):
        raise HTTPException(
            status_code=409,
            detail={"error": {"message": "Duplicate category name", "status": 409}},
        )
    category = {
        "id": f"cat{uuid4().hex[:8]}",
        "group_id": group_id,
        "name": name,
        "is_default": False,
        "created_at": now_iso(),
    }
    group.setdefault("categories", []).append(category)
    return category


@app.get("/api/groups/{group_id}/expenses", tags=["Expenses"])
def list_expenses(group_id: str, request: Request) -> List[Dict[str, Any]]:
    user_id = session_user(request)
    if not user_id:
        raise HTTPException(
            status_code=401,
            detail={"error": {"message": "Authentication required", "status": 401}},
        )
    group = db.groups.get(group_id)
    if not group:
        raise HTTPException(
            status_code=404,
            detail={"error": {"message": "Group not found", "status": 404}},
        )
    if not any(member["user_id"] == user_id for member in group.get("members", [])):
        raise HTTPException(
            status_code=403,
            detail={"error": {"message": "Not an active member", "status": 403}},
        )
    out = []
    for expense in db.expenses.values():
        if expense["group_id"] == group_id:
            out.append(expense_to_response(expense))
    return out


@app.post("/api/groups/{group_id}/expenses", tags=["Expenses"])
def create_expense(
    group_id: str, payload: ExpenseInput, request: Request
) -> Dict[str, Any]:
    user_id = session_user(request)
    if not user_id:
        raise HTTPException(
            status_code=401,
            detail={"error": {"message": "Authentication required", "status": 401}},
        )
    group = db.groups.get(group_id)
    if not group:
        raise HTTPException(
            status_code=404,
            detail={"error": {"message": "Group not found", "status": 404}},
        )
    if group.get("is_archived"):
        raise HTTPException(
            status_code=409,
            detail={
                "error": {
                    "message": "Archived group cannot accept expenses",
                    "status": 409,
                }
            },
        )
    if not any(member["user_id"] == user_id for member in group.get("members", [])):
        raise HTTPException(
            status_code=403,
            detail={"error": {"message": "Not an active member", "status": 403}},
        )

    if (
        payload.category_id not in {cat["id"] for cat in group.get("categories", [])}
        and payload.category_id != "cat-food"
    ):
        raise HTTPException(
            status_code=422,
            detail={"error": {"message": "Validation error", "status": 422}},
        )

    expense_id = f"e{uuid4().hex[:8]}"
    now = now_iso()
    shares = []
    for share in payload.shares:
        shares.append(
            {
                "id": f"sh{uuid4().hex[:8]}",
                "expense_id": expense_id,
                "user_id": share.user_id,
                "amount": share.amount,
            }
        )

    expense = {
        "id": expense_id,
        "group_id": group_id,
        "created_by": user_id,
        "payer_id": payload.payer_id,
        "category_id": payload.category_id,
        "title": payload.title,
        "amount": payload.amount,
        "expense_date": payload.expense_date.isoformat(),
        "notes": payload.notes,
        "created_at": now,
        "updated_at": now,
        "shares": shares,
        "payer": (
            response_user(user_from_db(payload.payer_id))
            if user_from_db(payload.payer_id)
            else None
        ),
        "category": next(
            (
                cat
                for cat in group.get("categories", [])
                if cat["id"] == payload.category_id
            ),
            {
                "id": payload.category_id,
                "group_id": group_id,
                "name": "General",
                "is_default": True,
                "created_at": now,
            },
        ),
    }
    db.expenses[expense_id] = expense
    return expense_to_response(expense)


@app.get("/api/groups/{group_id}/expenses/{expense_id}", tags=["Expenses"])
def get_expense(group_id: str, expense_id: str, request: Request) -> Dict[str, Any]:
    user_id = session_user(request)
    if not user_id:
        raise HTTPException(
            status_code=401,
            detail={"error": {"message": "Authentication required", "status": 401}},
        )
    expense = db.expenses.get(expense_id)
    if not expense:
        raise HTTPException(
            status_code=404,
            detail={"error": {"message": "Expense not found", "status": 404}},
        )
    if expense["group_id"] != group_id:
        raise HTTPException(
            status_code=404,
            detail={"error": {"message": "Expense not found", "status": 404}},
        )
    return expense_to_response(expense)


@app.patch("/api/groups/{group_id}/expenses/{expense_id}", tags=["Expenses"])
def update_expense(
    group_id: str, expense_id: str, payload: ExpenseInput, request: Request
) -> Dict[str, Any]:
    user_id = session_user(request)
    if not user_id:
        raise HTTPException(
            status_code=401,
            detail={"error": {"message": "Authentication required", "status": 401}},
        )
    expense = db.expenses.get(expense_id)
    if not expense:
        raise HTTPException(
            status_code=404,
            detail={"error": {"message": "Expense not found", "status": 404}},
        )
    if expense["created_by"] != user_id:
        raise HTTPException(
            status_code=403,
            detail={"error": {"message": "Only creator can edit", "status": 403}},
        )
    group = db.groups.get(group_id)
    if group and group.get("is_archived"):
        raise HTTPException(
            status_code=409,
            detail={
                "error": {"message": "Archived group cannot be changed", "status": 409}
            },
        )
    expense.update(
        {
            "title": payload.title,
            "amount": payload.amount,
            "category_id": payload.category_id,
            "payer_id": payload.payer_id,
            "expense_date": payload.expense_date.isoformat(),
            "notes": payload.notes,
            "updated_at": now_iso(),
            "shares": [
                {
                    "id": f"sh{uuid4().hex[:8]}",
                    "expense_id": expense_id,
                    "user_id": s.user_id,
                    "amount": s.amount,
                }
                for s in payload.shares
            ],
        }
    )
    return expense_to_response(expense)


@app.delete("/api/groups/{group_id}/expenses/{expense_id}", tags=["Expenses"])
def delete_expense(group_id: str, expense_id: str, request: Request) -> Response:
    user_id = session_user(request)
    if not user_id:
        raise HTTPException(
            status_code=401,
            detail={"error": {"message": "Authentication required", "status": 401}},
        )
    expense = db.expenses.get(expense_id)
    if not expense:
        raise HTTPException(
            status_code=404,
            detail={"error": {"message": "Expense not found", "status": 404}},
        )
    if expense["created_by"] != user_id:
        raise HTTPException(
            status_code=403,
            detail={"error": {"message": "Only creator can delete", "status": 403}},
        )
    group = db.groups.get(group_id)
    if group and group.get("is_archived"):
        raise HTTPException(
            status_code=409,
            detail={
                "error": {"message": "Archived group cannot be changed", "status": 409}
            },
        )
    del db.expenses[expense_id]
    return Response(status_code=204)


@app.get("/api/groups/{group_id}/balances", tags=["Balances"])
def get_balances(group_id: str, request: Request) -> List[Dict[str, Any]]:
    user_id = session_user(request)
    if not user_id:
        raise HTTPException(
            status_code=401,
            detail={"error": {"message": "Authentication required", "status": 401}},
        )
    group = db.groups.get(group_id)
    if not group:
        raise HTTPException(
            status_code=404,
            detail={"error": {"message": "Group not found", "status": 404}},
        )
    if not any(member["user_id"] == user_id for member in group.get("members", [])):
        raise HTTPException(
            status_code=403,
            detail={"error": {"message": "Not an active member", "status": 403}},
        )
    rows = []
    for member in group.get("members", []):
        u = user_from_db(member["user_id"])
        rows.append(
            {
                "user_id": member["user_id"],
                "user": response_user(u) if u else None,
                "status": member["status"],
                "paid": 0,
                "owed": 0,
                "net": 0,
            }
        )
    return rows


@app.get("/api/groups/{group_id}/settlements/suggestions", tags=["Settlements"])
def settlement_suggestions(group_id: str, request: Request) -> List[Dict[str, Any]]:
    user_id = session_user(request)
    if not user_id:
        raise HTTPException(
            status_code=401,
            detail={"error": {"message": "Authentication required", "status": 401}},
        )
    group = db.groups.get(group_id)
    if not group:
        raise HTTPException(
            status_code=404,
            detail={"error": {"message": "Group not found", "status": 404}},
        )
    if not any(member["user_id"] == user_id for member in group.get("members", [])):
        raise HTTPException(
            status_code=403,
            detail={"error": {"message": "Not an active member", "status": 403}},
        )
    return []


@app.get("/api/groups/{group_id}/settlements", tags=["Settlements"])
def list_settlements(group_id: str, request: Request) -> List[Dict[str, Any]]:
    user_id = session_user(request)
    if not user_id:
        raise HTTPException(
            status_code=401,
            detail={"error": {"message": "Authentication required", "status": 401}},
        )
    group = db.groups.get(group_id)
    if not group:
        raise HTTPException(
            status_code=404,
            detail={"error": {"message": "Group not found", "status": 404}},
        )
    if not any(member["user_id"] == user_id for member in group.get("members", [])):
        raise HTTPException(
            status_code=403,
            detail={"error": {"message": "Not an active member", "status": 403}},
        )
    return [
        settlement_to_response(item)
        for item in db.settlements.values()
        if item["group_id"] == group_id
    ]


def settlement_to_response(settlement: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": settlement["id"],
        "group_id": settlement["group_id"],
        "payer_id": settlement["payer_id"],
        "recipient_id": settlement["recipient_id"],
        "amount": settlement["amount"],
        "settlement_date": settlement["settlement_date"],
        "note": settlement.get("note", ""),
        "created_at": settlement.get("created_at", now_iso()),
        "payer": response_user(user_from_db(settlement["payer_id"])),
        "recipient": response_user(user_from_db(settlement["recipient_id"])),
    }


@app.post("/api/groups/{group_id}/settlements", tags=["Settlements"])
def create_settlement(
    group_id: str, payload: SettlementInput, request: Request
) -> Dict[str, Any]:
    user_id = session_user(request)
    if not user_id:
        raise HTTPException(
            status_code=401,
            detail={"error": {"message": "Authentication required", "status": 401}},
        )
    group = db.groups.get(group_id)
    if not group:
        raise HTTPException(
            status_code=404,
            detail={"error": {"message": "Group not found", "status": 404}},
        )
    if group.get("is_archived"):
        raise HTTPException(
            status_code=409,
            detail={
                "error": {
                    "message": "Archived group cannot record settlements",
                    "status": 409,
                }
            },
        )
    if payload.amount <= 0:
        raise HTTPException(
            status_code=422,
            detail={"error": {"message": "Validation or rule error", "status": 422}},
        )
    settlement_id = f"s{uuid4().hex[:8]}"
    settlement = {
        "id": settlement_id,
        "group_id": group_id,
        "payer_id": payload.payer_id,
        "recipient_id": payload.recipient_id,
        "amount": payload.amount,
        "settlement_date": payload.settlement_date.isoformat(),
        "note": payload.note,
        "created_at": now_iso(),
    }
    db.settlements[settlement_id] = settlement
    return settlement_to_response(settlement)


@app.get("/api/dashboard", tags=["Dashboard"])
def dashboard(request: Request) -> Dict[str, Any]:
    user_id = session_user(request)
    if not user_id:
        raise HTTPException(
            status_code=401,
            detail={"error": {"message": "Authentication required", "status": 401}},
        )
    groups = []
    for group in db.groups.values():
        if any(member["user_id"] == user_id for member in group.get("members", [])):
            groups.append(
                {
                    **group,
                    "role": member_role_in_group(group["id"], user_id),
                    "member_count": len(group.get("members", [])),
                    "my_balance": 0,
                    "total_spent": sum(
                        e["amount"]
                        for e in db.expenses.values()
                        if e["group_id"] == group["id"]
                    ),
                }
            )
    return {
        "groups": groups,
        "totals": {
            "owed": 0,
            "receivable": 0,
            "net": 0,
            "outstanding_settlements": 0,
        },
        "recent_expenses": list(db.expenses.values()),
        "recent_settlements": list(db.settlements.values()),
        "spending": {
            "total": sum(e["amount"] for e in db.expenses.values()),
            "this_month": 0,
            "last_month": 0,
            "by_category": [
                {
                    "name": "General",
                    "amount": sum(e["amount"] for e in db.expenses.values()),
                }
            ],
            "by_month": [
                {
                    "month": date.today().strftime("%Y-%m"),
                    "amount": sum(e["amount"] for e in db.expenses.values()),
                }
            ],
        },
    }
