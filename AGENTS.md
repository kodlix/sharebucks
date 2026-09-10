# AGENTS

This workspace contains the ShareBucks full-stack project. It includes a Vite + TanStack Start TypeScript frontend, a FastAPI mock backend, and a shared OpenAPI contract.

## Working rules
- Keep the existing UI, routes, shared library utilities, and public API behavior working.
- Prefer extending the current folder structure and established frontend/backend patterns instead of introducing duplicated scaffolds.
- Preserve the OpenAPI contract in `openapi.yaml` and keep frontend and backend examples aligned with it.
- Do not rewrite published git history.
- Favor incremental edits that fit the repository's existing architecture.

## Project shape

- `frontend/` holds the UI, routes, components, route definitions, and API service code.
- `backend/` holds FastAPI app code, data models, mock database, and backend tests.
- `_docs/` holds product and implementation specs.
- `Makefile` provides common workspace tasks for backend and frontend install, test, build, and run steps.

Common top-level tasks:

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

The Makefile is the preferred shortcut for the repository’s most common developer workflows, while the underlying commands remain available directly in the frontend and backend folders.

## Contribution expectations

Use the existing frontend and backend folders for feature changes. When changing application behavior, keep the types, API services, and tests aligned so the full-stack contract remains coherent.
