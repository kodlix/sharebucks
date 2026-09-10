from __future__ import annotations

import os
from typing import Any, Dict, Iterable, Mapping, Optional, Type, cast

from sqlalchemy import Boolean, Column, Float, JSON, String, create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.pool import StaticPool


class Base(DeclarativeBase):
    pass


class UserRecord(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True)
    email = Column(String, nullable=False, unique=True)
    password = Column(String, nullable=False)
    display_name = Column(String, nullable=False)
    created_at = Column(String, nullable=False)


class GroupRecord(Base):
    __tablename__ = "groups"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=False)
    visibility = Column(String, nullable=False)
    currency = Column(String, nullable=False)
    created_by = Column(String, nullable=False)
    is_archived = Column(Boolean, default=False, nullable=False)
    created_at = Column(String, nullable=False)
    updated_at = Column(String, nullable=False)
    members = Column(JSON, default=list)
    categories = Column(JSON, default=list)


class ExpenseRecord(Base):
    __tablename__ = "expenses"

    id = Column(String, primary_key=True)
    group_id = Column(String, nullable=False)
    created_by = Column(String, nullable=False)
    payer_id = Column(String, nullable=False)
    category_id = Column(String, nullable=False)
    title = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    expense_date = Column(String, nullable=False)
    notes = Column(String, nullable=True, default="")
    created_at = Column(String, nullable=False)
    updated_at = Column(String, nullable=False)
    shares = Column(JSON, default=list)
    payer = Column(JSON, default=None)
    category = Column(JSON, default=None)


class SettlementRecord(Base):
    __tablename__ = "settlements"

    id = Column(String, primary_key=True)
    group_id = Column(String, nullable=False)
    payer_id = Column(String, nullable=False)
    recipient_id = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    settlement_date = Column(String, nullable=False)
    note = Column(String, nullable=True, default="")
    created_at = Column(String, nullable=False)


class MutableList(list):
    def __init__(self, parent: "MutableRecord", key: str, items: list[Any]) -> None:
        super().__init__(items)
        self._parent = parent
        self._key = key

    def _persist(self) -> None:
        self._parent._persist()

    def append(self, item: Any) -> None:
        super().append(item)
        self._persist()

    def extend(self, iterable: Iterable[Any]) -> None:
        super().extend(iterable)
        self._persist()

    def insert(self, index: int, item: Any) -> None:
        super().insert(index, item)
        self._persist()

    def pop(self, index: int = -1) -> Any:
        value = super().pop(index)
        self._persist()
        return value

    def remove(self, item: Any) -> None:
        super().remove(item)
        self._persist()

    def clear(self) -> None:
        super().clear()
        self._persist()


class MutableRecord(dict):
    def __init__(self, store: "SQLAlchemyStore", model: type[Base], record_id: str, payload: Dict[str, Any]) -> None:
        super().__init__(payload)
        self._store = store
        self._model = model
        self._record_id = record_id
        self._hydrate_lists()

    def _hydrate_lists(self) -> None:
        for key in ("members", "categories", "shares"):
            if key in self and isinstance(self[key], list):
                self[key] = MutableList(self, key, self[key])

    def _persist(self) -> None:
        self._store._persist_record(self._model, self._record_id, dict(self))

    def __setitem__(self, key: str, value: Any) -> None:
        super().__setitem__(key, value)
        if isinstance(value, list):
            value = MutableList(self, key, value)
            super().__setitem__(key, value)
        self._persist()

    def update(self, other: Mapping[str, Any] | None = None, **kwargs: Any) -> None:
        if other:
            for key, value in other.items():
                self[key] = value
        for key, value in kwargs.items():
            self[key] = value

    def pop(self, key: str, default: Any = None) -> Any:
        value = super().pop(key, default)
        self._persist()
        return value


class SQLAlchemyCollection:
    def __init__(self, store: "SQLAlchemyStore", model: type[Base]) -> None:
        self.store = store
        self.model = model

    def values(self) -> list[Dict[str, Any]]:
        rows = self.store.session.query(self.model).all()
        return [self.store.row_to_dict(row) for row in rows]

    def keys(self) -> list[str]:
        rows = self.store.session.query(self.model).all()
        return [row.id for row in rows]

    def items(self) -> list[tuple[str, Dict[str, Any]]]:
        rows = self.store.session.query(self.model).all()
        return [(row.id, self.store.row_to_dict(row)) for row in rows]

    def __contains__(self, item: str) -> bool:
        return self.store.session.query(self.model).filter_by(id=item).first() is not None

    def get(self, key: str, default: Any = None) -> MutableRecord | Any:
        row = self.store.session.query(self.model).filter_by(id=key).first()
        if row is None:
            return default
        return self.__getitem__(key)

    def __getitem__(self, key: str) -> MutableRecord:
        row = self.store.session.query(self.model).filter_by(id=key).first()
        if row is None:
            raise KeyError(key)
        return MutableRecord(self.store, self.model, key, self.store.row_to_dict(row))

    def __setitem__(self, key: str, value: Dict[str, Any]) -> None:
        self.store._persist_record(self.model, key, value)

    def __delitem__(self, key: str) -> None:
        row = self.store.session.query(self.model).filter_by(id=key).first()
        if row is None:
            raise KeyError(key)
        self.store.session.delete(row)
        self.store.session.commit()

    def __iter__(self):
        return iter(self.keys())

    def __len__(self) -> int:
        return self.store.session.query(self.model).count()


class SQLAlchemyStore:
    def __init__(self, database_url: Optional[str] = None) -> None:
        raw_url = database_url or os.getenv("SHAREBUCKS_DB_URL", "sqlite:///./sharebucks.db")
        if raw_url.startswith("sqlite"):
            self.engine = create_engine(raw_url, connect_args={"check_same_thread": False}, poolclass=StaticPool)
        else:
            self.engine = create_engine(raw_url)
        self.Session = sessionmaker(bind=self.engine, autoflush=False, autocommit=False)
        self.session = self.Session()
        Base.metadata.create_all(bind=self.engine)
        self.users = SQLAlchemyCollection(self, UserRecord)
        self.groups = SQLAlchemyCollection(self, GroupRecord)
        self.expenses = SQLAlchemyCollection(self, ExpenseRecord)
        self.settlements = SQLAlchemyCollection(self, SettlementRecord)
        self.current_user_id = None
        self.seed()

    def row_to_dict(self, row: Base) -> Dict[str, Any]:
        data = {}
        for column in row.__table__.columns:
            data[column.key] = getattr(row, column.key)
        return data

    def reset(self) -> None:
        try:
            self.session.close()
        except Exception:
            pass
        Base.metadata.drop_all(bind=self.engine)
        Base.metadata.create_all(bind=self.engine)
        self.session = self.Session()
        self.current_user_id = None
        self.seed()

    def _persist_record(self, model: Type[Base], record_id: str, payload: Dict[str, Any]) -> None:
        row = self.session.query(model).filter_by(id=record_id).first()
        if row is None:
            row = model(id=record_id)
            self.session.add(row)
        for key, value in payload.items():
            if hasattr(row, key):
                if isinstance(value, MutableList):
                    value = list(value)
                if isinstance(value, MutableRecord):
                    value = dict(value)
                setattr(row, key, value)
        self.session.commit()

    def seed(self) -> None:
        self.current_user_id = "u1"
        users = {
            "u1": {
                "id": "u1",
                "email": "demo@sharebucks.app",
                "password": "password123",
                "display_name": "Demo User",
                "created_at": "2026-09-10T00:00:00+00:00",
            },
            "u2": {
                "id": "u2",
                "email": "friend@example.com",
                "password": "secret123",
                "display_name": "Friend",
                "created_at": "2026-09-10T00:00:00+00:00",
            },
        }
        # Keep the route contract service-level API and the SQLAlchemy table rows in sync.
        for record_id, payload in users.items():
            self.users[record_id] = payload

        groups = {
            "g1": {
                "id": "g1",
                "name": "Trip Crew",
                "description": "Summer trip",
                "visibility": "public",
                "currency": "USD",
                "created_by": "u1",
                "is_archived": False,
                "created_at": "2026-09-10T00:00:00+00:00",
                "updated_at": "2026-09-10T00:00:00+00:00",
                "members": [
                    {"id": "m1", "group_id": "g1", "user_id": "u1", "role": "admin", "status": "active", "joined_at": "2026-09-10T00:00:00+00:00", "left_at": None, "user": users["u1"]},
                    {"id": "m2", "group_id": "g1", "user_id": "u2", "role": "member", "status": "active", "joined_at": "2026-09-10T00:00:00+00:00", "left_at": None, "user": users["u2"]},
                ],
                "categories": [],
            }
        }
        for record_id, payload in groups.items():
            self.groups[record_id] = payload


db = SQLAlchemyStore()
