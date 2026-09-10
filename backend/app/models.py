from pydantic import BaseModel, EmailStr, Field
from typing import Literal, Optional, List
from datetime import datetime, date


class User(BaseModel):
    id: str
    email: EmailStr
    display_name: str
    created_at: datetime


class Group(BaseModel):
    id: str
    name: str
    description: str
    visibility: Literal["private", "public"]
    currency: str = Field(pattern=r"^[A-Z]{3}$")
    created_by: str
    is_archived: bool
    created_at: datetime
    updated_at: datetime


class GroupMember(BaseModel):
    id: str
    group_id: str
    user_id: str
    role: Literal["admin", "member"]
    status: Literal["active", "inactive"]
    joined_at: datetime
    left_at: Optional[datetime]
    user: User


class GroupInvite(BaseModel):
    id: str
    group_id: str
    created_by: str
    code: str
    expires_at: datetime
    created_at: datetime


class Category(BaseModel):
    id: str
    group_id: str
    name: str
    is_default: bool
    created_at: datetime


class ExpenseShare(BaseModel):
    id: str
    expense_id: str
    user_id: str
    amount: int


class Expense(BaseModel):
    id: str
    group_id: str
    created_by: str
    payer_id: str
    category_id: str
    title: str
    amount: int
    expense_date: date
    notes: str
    created_at: datetime
    updated_at: datetime
    shares: List[ExpenseShare]
    payer: User
    category: Category


class Settlement(BaseModel):
    id: str
    group_id: str
    payer_id: str
    recipient_id: str
    amount: int
    settlement_date: date
    note: str
    created_at: datetime
    payer: User
    recipient: User


class MemberBalance(BaseModel):
    user_id: str
    user: User
    status: Literal["active", "inactive"]
    paid: int
    owed: int
    net: int


class SettlementSuggestion(BaseModel):
    payer_id: str
    recipient_id: str
    payer: User
    recipient: User
    amount: int


class GroupSummary(Group):
    role: Literal["admin", "member"]
    member_count: int
    my_balance: int
    total_spent: int


class GroupDetail(Group):
    role: Literal["admin", "member"]
    members: List[GroupMember]
    categories: List[Category]


class DiscoverGroup(Group):
    member_count: int
    is_member: bool


class DashboardTotals(BaseModel):
    owed: int
    receivable: int
    net: int
    outstanding_settlements: int


class DashboardSpendingCategory(BaseModel):
    name: str
    amount: int


class DashboardSpendingMonth(BaseModel):
    month: str
    amount: int


class DashboardSpending(BaseModel):
    total: int
    this_month: int
    last_month: int
    by_category: List[DashboardSpendingCategory]
    by_month: List[DashboardSpendingMonth]


class DashboardData(BaseModel):
    groups: List[GroupSummary]
    totals: DashboardTotals
    recent_expenses: List[Expense]
    recent_settlements: List[Settlement]
    spending: DashboardSpending


class RegisterInput(BaseModel):
    email: EmailStr
    password: str
    display_name: str


class LoginInput(BaseModel):
    email: EmailStr
    password: str


class CreateGroupInput(BaseModel):
    name: str
    description: str
    visibility: Literal["private", "public"]
    currency: str = Field(pattern=r"^[A-Z]{3}$")


class UpdateGroupInput(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    visibility: Optional[Literal["private", "public"]] = None
    currency: Optional[str] = Field(default=None, pattern=r"^[A-Z]{3}$")


class ExpenseInput(BaseModel):
    title: str
    amount: int
    category_id: str
    payer_id: str
    expense_date: date
    notes: str
    shares: List["ShareInput"]


class ShareInput(BaseModel):
    user_id: str
    amount: int


class SettlementInput(BaseModel):
    payer_id: str
    recipient_id: str
    amount: int
    settlement_date: date
    note: str
