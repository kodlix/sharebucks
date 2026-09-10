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

The repository also ships with a top-level `Makefile` that wraps the most common install, build, test, and run commands.

```sh
make help
make backend-install
make backend-test
make backend-run
make frontend-install
make frontend-build
make frontend-run
make all-tests
make all-run
```

Use `make help` to see the supported task names, or run the commands directly from the corresponding folders.

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
