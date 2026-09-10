# ShareBucks

ShareBucks is a full-stack expense-sharing application for tracking, splitting, and settling shared group costs. The workspace combines a Vite + TanStack Start frontend with a FastAPI backend and a shared OpenAPI contract.

## Project overview

The app is organized around groups, members, expenses, balances, and settlement flows. Users can register, log in, create or join groups, add expenses, and see balances that are simplified into repayment recommendations.

## Repository layout

- `frontend/` contains the TypeScript UI, routes, components, service layer, and tests.
- `backend/` contains the FastAPI application, Pydantic models, mock database, and backend tests.
- `openapi.yaml` is the canonical API contract that drives the backend and frontend expectations.
- `_docs/` contains project specifications and planning notes.

## Local development

### Frontend

```sh
cd frontend
npm install
npm run dev
```

### Backend

```sh
cd backend
uv sync
uv run uvicorn app.main:app --reload
```

## API contract

The shared contract lives in `openapi.yaml`. Backend development should remain aligned with that API surface, and any frontend service work should preserve the generated contract expectations.

## Testing

```sh
cd frontend
npm test
```

```sh
cd backend
pytest
```
