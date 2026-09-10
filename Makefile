PYTHON ?= python3
UV ?= uv
NPM ?= npm

.PHONY: backend-install backend-test backend-run frontend-install frontend-build frontend-run help

help:
	@echo "Usage: make backend-install | backend-test | backend-run | frontend-install | frontend-build | frontend-run | all-tests | all-run"

backend-install:
	cd backend && $(UV) sync

backend-test:
	cd backend && $(UV) run pytest tests/test_api.py

backend-run:
	cd backend && $(UV) run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

frontend-install:
	cd frontend && $(NPM) install

frontend-build:
	cd frontend && $(NPM) run build

frontend-run:
	cd frontend && $(NPM) run dev -- --host 0.0.0.0

run-all:
	$(MAKE) backend-test
	$(MAKE) backend-run &
	$(MAKE) frontend-run

all-tests: backend-test

all-run: run-all
