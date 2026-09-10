from datetime import datetime, timezone
from typing import Dict, Any, List


class MockDB:
    def __init__(self) -> None:
        self.users: Dict[str, Dict[str, Any]] = {}
        self.groups: Dict[str, Dict[str, Any]] = {}
        self.expenses: Dict[str, Dict[str, Any]] = {}
        self.settlements: Dict[str, Dict[str, Any]] = {}
        self.current_user_id: Optional[str] = None

    def seed(self) -> None:
        self.current_user_id = "u1"
        self.users["u1"] = {
            "id": "u1",
            "email": "demo@sharebucks.app",
            "password": "password123",
            "display_name": "Demo User",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        self.users["u2"] = {
            "id": "u2",
            "email": "friend@example.com",
            "password": "secret123",
            "display_name": "Friend",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        self.groups["g1"] = {
            "id": "g1",
            "name": "Trip Crew",
            "description": "Summer trip",
            "visibility": "public",
            "currency": "USD",
            "created_by": "u1",
            "is_archived": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "role": "admin",
            "members": [
                {"id": "m1", "group_id": "g1", "user_id": "u1", "role": "admin", "status": "active", "joined_at": datetime.now(timezone.utc).isoformat(), "left_at": None, "user": self.users["u1"]},
                {"id": "m2", "group_id": "g1", "user_id": "u2", "role": "member", "status": "active", "joined_at": datetime.now(timezone.utc).isoformat(), "left_at": None, "user": self.users["u2"]},
            ],
            "categories": [],
            "member_count": 2,
            "my_balance": 0,
            "total_spent": 0,
        }


db = MockDB()
db.seed()
