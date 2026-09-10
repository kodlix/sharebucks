# ShareBucks — Project Specification

## 1. Overview

**ShareBucks** is a full-stack expense-sharing application for groups such as trips, dinners, roommates, families, clubs, and events.

### MVP Goal

Users can:
1. Register and sign in.
2. Create or join groups.
3. Record shared expenses.
4. Split expenses equally or by custom amounts.
5. View automatically calculated balances.
6. Record full or partial settlements.
7. Review group activity and spending summaries.

### Out of Scope

- Payment processing or money transfers
- Multi-currency conversion
- Recurring expenses
- Receipt/file uploads or OCR
- Comments, chat, and notifications
- Full audit history
- Advanced analytics
- Mobile apps and offline support

## 2. Authentication

- Register, sign in, sign out, and view the authenticated profile.
- Email addresses are unique.
- Passwords are securely hashed.
- Protected resources require backend authentication and authorization.
- Authentication uses HTTP-only cookies; credentials must not be stored in `localStorage`.
- Production cookies must use secure settings and appropriate CSRF protection.

## 3. Groups & Membership

Each expense belongs to a group. A group has:
- Name
- Description
- Visibility: private or public
- One ISO 4217 currency
- One administrator

### Roles

**Administrator**
- Manages membership
- Removes members
- Archives the group

**Member**
- Views group information
- Creates, edits, and deletes their own expenses
- Records settlements

### Joining & Leaving

- Public groups can be discovered, searched, and joined.
- Private groups can be joined through an invitation link or code.
- Members can leave a group.
- A leaving member becomes inactive and group balances/expense participation are recalculated as required.
- Archived groups retain historical data but accept no new expenses or members.

## 4. Expenses

An expense contains:
- Title
- Amount
- Category
- Payer
- Date
- Optional notes
- Shares

Rules:
- Only active members can create expenses.
- The payer must be an active member.
- All active members participate in new expenses by default.
- Equal splitting is the default.
- Custom share amounts are supported.
- Share totals must exactly equal the expense amount.
- Only the creator can edit or delete an expense.
- Changes automatically recalculate balances and dashboard statistics.

Default categories include Food, Transport, Accommodation, Utilities, Shopping, Entertainment, Travel, and Other. Users may create custom categories.

## 5. Balances & Settlements

### Balance Calculation

For each expense:

```text
payer balance += expense amount
member balance -= member share
```

For each settlement:

```text
payer balance += settlement amount
recipient balance -= settlement amount
```

```text
Net Balance = Amount Paid - Amount Owed
```

- Positive: member should receive money.
- Negative: member owes money.
- Zero: settled.

Balances must update after expense creation, editing, deletion, settlements, partial settlements, and membership changes.

Money should use precise values such as integer minor units rather than binary floating point.

### Settlement Suggestions

The system separates debtors and creditors and generates transactions that reduce outstanding balances while minimizing unnecessary transactions.

### Recorded Settlements

A settlement contains:
- Payer
- Recipient
- Amount
- Date
- Optional note

Recording a settlement only tracks payment; it does not transfer money. Partial payments are supported and cannot exceed the applicable outstanding debt.

## 6. Dashboard

The dashboard provides:
- Active and archived groups, roles, currencies, and balances
- Amount owed, amount receivable, net balance, and outstanding settlements
- Recent expenses with title, amount, group, payer, date, and category
- Recent settlements and remaining amounts
- Spending totals, category breakdowns, and period-based summaries

## 7. API

REST/JSON endpoints:

```text
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me

GET    /api/groups
POST   /api/groups
GET    /api/groups/{group_id}
PATCH  /api/groups/{group_id}
POST   /api/groups/{group_id}/archive
POST   /api/groups/{group_id}/leave

GET    /api/groups/{group_id}/members
POST   /api/groups/{group_id}/invites
POST   /api/groups/{group_id}/join
DELETE /api/groups/{group_id}/members/{user_id}

GET    /api/groups/discover
GET    /api/groups/discover?search=...

GET    /api/groups/{group_id}/expenses
POST   /api/groups/{group_id}/expenses
GET    /api/groups/{group_id}/expenses/{expense_id}
PATCH  /api/groups/{group_id}/expenses/{expense_id}
DELETE /api/groups/{group_id}/expenses/{expense_id}

GET    /api/groups/{group_id}/balances
GET    /api/groups/{group_id}/settlements/suggestions
GET    /api/groups/{group_id}/settlements
POST   /api/groups/{group_id}/settlements

GET    /api/dashboard
```

Use consistent HTTP status codes and predictable JSON errors such as `400`, `401`, `403`, `404`, `409`, `422`, and `500`.

## 8. Data Model

Core entities:

- **User:** `id`, `email`, `password_hash`, `display_name`, timestamps
- **Group:** `id`, `name`, `description`, `visibility`, `currency`, `created_by`, `is_archived`, timestamps
- **GroupMember:** `id`, `group_id`, `user_id`, `role`, `status`, `joined_at`, `left_at`
- **GroupInvite:** `id`, `group_id`, `created_by`, `code/token`, `expires_at`, `created_at`
- **Category:** `id`, `group_id`, `name`, `is_default`, `created_at`
- **Expense:** `id`, `group_id`, `created_by`, `payer_id`, `category_id`, `title`, `amount`, `expense_date`, `notes`, timestamps
- **ExpenseShare:** `id`, `expense_id`, `user_id`, `amount`
- **Settlement:** `id`, `group_id`, `payer_id`, `recipient_id`, `amount`, `settlement_date`, `note`, `created_at`

Key constraints:
- A user has one active membership per group.
- Each group has one active administrator.
- Expense shares must match the expense total.
- Private resources require active membership.

## 9. Architecture & Technology

```text
React / Vite
     │ REST/JSON
     ▼
FastAPI
     │
     ▼
SQLite
```

### Backend

- Python
- `uv`
- FastAPI
- Pydantic
- SQLAlchemy 2.x
- Alembic

### Frontend

- React
- TypeScript
- Vite
- React Router
- TanStack Query
- React Hook Form
- Zod
- Tailwind CSS

The frontend communicates with the backend exclusively through the REST API. API routes should remain thin, with business logic in services.

## 10. Repository Structure

```text
sharebucks/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   ├── db/
│   │   └── dependencies/
│   └── tests/
├── frontend/
│   └── src/
│       ├── app/
│       ├── components/
│       ├── features/
│       ├── pages/
│       ├── services/
│       ├── hooks/
│       └── types/
├── docs/
│   └── specification.md
├── README.md
└── docker-compose.yml
```

Organize frontend code by feature rather than placing all components in one directory.

## 11. UI / UX

Primary screens:
- Sign Up / Login
- Dashboard
- Groups
- Group Details
- Expense Create/Edit/Details
- Group Discovery
- Profile/Settings

The interface should use a clean, simple financial-dashboard style.

## 12. Testing & Quality

Backend tests should cover:
- Authentication and authorization
- Group creation/joining/membership
- Expense CRUD and validation
- Equal and custom splitting
- Balance calculations
- Full and partial settlements
- Group archiving

Frontend tests should cover:
- Authentication
- Group flows
- Expense forms
- Balance and settlement displays
- Dashboard
- Protected routes

Recommended tools: `pytest`, FastAPI TestClient/httpx, Vitest, and optionally Playwright.

Security and maintainability requirements:
- Validate input server-side.
- Enforce authorization on the backend.
- Prevent SQL injection through ORM/query parameterization.
- Avoid leaking implementation details in errors.
- Use migrations.
- Keep financial calculations deterministic and tested.
- Keep database access abstracted so SQLite can later be replaced by PostgreSQL.

## 13. Development Phases

1. **Foundation:** repository, FastAPI, React/Vite, SQLite, SQLAlchemy, Alembic, API integration
2. **Authentication:** registration, login, logout, protected routes
3. **Groups:** creation, visibility, membership, invitations, discovery, archiving
4. **Expenses:** categories, splitting, CRUD, validation
5. **Balances:** calculation service, API, UI
6. **Settlements:** suggestions, recording, partial payments, history
7. **Dashboard:** groups, activity, balances, spending summaries
8. **Quality:** tests, security review, error handling, UI polish, README, deployment/demo preparation

## 14. MVP Acceptance Criteria

The MVP is complete when users can register/login, create or join public/private groups, manage authorized membership, create and manage expenses, split expenses, view accurate balances, receive settlement suggestions, record full or partial settlements, and view dashboard activity and spending summaries using the React + FastAPI + SQLite stack.
