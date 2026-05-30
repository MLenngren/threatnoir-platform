.DEFAULT_GOAL := help
SHELL := /bin/bash

DC      := docker compose
DC_CLI  := docker compose -f compose.yaml -f compose.cli.yaml
APP_URL := http://localhost:$(shell grep -E '^APP_PORT=' .env 2>/dev/null | cut -d= -f2 | head -1 || echo 7000)
STUDIO_URL := http://localhost:$(shell grep -E '^SUPABASE_STUDIO_PORT=' .env 2>/dev/null | cut -d= -f2 | head -1 || echo 7101)
KONG_URL   := http://localhost:$(shell grep -E '^SUPABASE_KONG_PORT=' .env 2>/dev/null | cut -d= -f2 | head -1 || echo 7100)

CRON_SECRET := $(shell grep -E '^CRON_SECRET=' .env 2>/dev/null | cut -d= -f2- | head -1)

CYAN := \033[36m
GREEN := \033[32m
YELLOW := \033[33m
RED := \033[31m
RESET := \033[0m

.PHONY: help
help: ## Show this help
	@printf "$(CYAN)threatnoir-platform — operator commands$(RESET)\n\n"
	@printf "$(YELLOW)Lifecycle$(RESET)\n"
	@grep -E '^(up|up-cli|down|down-clean|restart|rebuild|build):.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  $(GREEN)%-18s$(RESET) %s\n", $$1, $$2}'
	@printf "\n$(YELLOW)Inspection$(RESET)\n"
	@grep -E '^(ps|health|logs|logs-[a-z-]+):.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  $(GREEN)%-18s$(RESET) %s\n", $$1, $$2}'
	@printf "\n$(YELLOW)Operations$(RESET)\n"
	@grep -E '^(ingest|summarize|awareness|psql|studio|verify|verify-isolation):.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  $(GREEN)%-18s$(RESET) %s\n", $$1, $$2}'
	@printf "\n$(YELLOW)Fresh install (no-cost: BOOTSTRAP_RUN_AI=false)$(RESET)\n"
	@grep -E '^(fresh|fresh-with-ai):.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  $(GREEN)%-18s$(RESET) %s\n", $$1, $$2}'

## ---------- lifecycle ----------

.PHONY: up
up: ## Bring up default stack (claude API provider)
	$(DC) up -d
	@printf "$(GREEN)Stack up.$(RESET) App: $(APP_URL)  Studio: $(STUDIO_URL)\n"

.PHONY: up-cli
up-cli: ## Bring up stack with host claude CLI as provider (requires ~/.claude.json)
	@test -f $$HOME/.claude.json || { printf "$(RED)Missing ~/.claude.json — run 'claude' on host once to log in first.$(RESET)\n"; exit 1; }
	$(DC_CLI) up -d --build ai-gateway
	$(DC) up -d
	@printf "$(GREEN)Stack up with CLI provider.$(RESET) Verify: make logs-ai\n"

.PHONY: down
down: ## Stop all services (volumes preserved)
	$(DC) down

.PHONY: down-clean
down-clean: ## Stop all services AND wipe volumes (destroys DB!)
	@printf "$(RED)This will DELETE all data in supabase volumes. Ctrl-C to abort.$(RESET)\n"; sleep 3
	$(DC) down -v

.PHONY: restart
restart: ## Restart all services
	$(DC) restart

.PHONY: rebuild
rebuild: ## Rebuild + restart all services
	$(DC) up -d --build

.PHONY: build
build: ## Build all images without starting
	$(DC) build

## ---------- inspection ----------

.PHONY: ps
ps: ## Show service status
	@$(DC) ps --format 'table {{.Service}}\t{{.Status}}\t{{.Ports}}'

.PHONY: health
health: ## Show container health states
	@docker ps --filter "label=com.docker.compose.project=threatnoir-platform" --format 'table {{.Names}}\t{{.Status}}'

.PHONY: logs
logs: ## Tail all service logs (Ctrl-C to exit)
	$(DC) logs -f --tail=50

.PHONY: logs-app
logs-app: ## Tail Nuxt app logs
	$(DC) logs -f --tail=100 app

.PHONY: logs-ai
logs-ai: ## Tail ai-gateway logs
	$(DC) logs -f --tail=100 ai-gateway

.PHONY: logs-cron
logs-cron: ## Tail supercronic logs
	$(DC) logs -f --tail=100 cron

.PHONY: logs-bootstrap
logs-bootstrap: ## Show bootstrap (one-shot) output
	$(DC) logs --tail=200 bootstrap

.PHONY: logs-db
logs-db: ## Tail supabase-db logs
	$(DC) logs -f --tail=100 supabase-db

## ---------- operations ----------

.PHONY: ingest
ingest: ## Manually trigger article ingestion
	@test -n "$(CRON_SECRET)" || { printf "$(RED)CRON_SECRET not in .env$(RESET)\n"; exit 1; }
	@curl -sS -X POST -H "x-cron-secret: $(CRON_SECRET)" -w '\n$(GREEN)HTTP %{http_code}$(RESET) | %{time_total}s\n' $(APP_URL)/api/cron/ingest

.PHONY: summarize
summarize: ## Manually trigger article summarization (uses AI provider)
	@test -n "$(CRON_SECRET)" || { printf "$(RED)CRON_SECRET not in .env$(RESET)\n"; exit 1; }
	@curl -sS -X POST -H "x-cron-secret: $(CRON_SECRET)" -w '\n$(GREEN)HTTP %{http_code}$(RESET) | %{time_total}s\n' $(APP_URL)/api/cron/summarize

.PHONY: awareness
awareness: ## Manually trigger awareness page generation
	@test -n "$(CRON_SECRET)" || { printf "$(RED)CRON_SECRET not in .env$(RESET)\n"; exit 1; }
	@curl -sS -X POST -H "x-cron-secret: $(CRON_SECRET)" -w '\n$(GREEN)HTTP %{http_code}$(RESET) | %{time_total}s\n' $(APP_URL)/api/cron/generate-awareness

.PHONY: psql
psql: ## Open psql shell against supabase-db
	$(DC) exec supabase-db psql -U postgres -d postgres

.PHONY: studio
studio: ## Print Supabase Studio URL + credentials
	@printf "$(CYAN)Supabase Studio:$(RESET) $(STUDIO_URL)\n"
	@printf "$(CYAN)Kong API gw:$(RESET)     $(KONG_URL)\n"
	@printf "$(CYAN)Username:$(RESET)        %s\n" "$$(grep -E '^DASHBOARD_USERNAME=' .env | cut -d= -f2-)"
	@printf "$(CYAN)Password:$(RESET)        %s\n" "$$(grep -E '^DASHBOARD_PASSWORD=' .env | cut -d= -f2-)"

.PHONY: verify
verify: ## Health + content sanity check
	@printf "$(CYAN)Containers:$(RESET)\n"
	@$(DC) ps --format 'table {{.Service}}\t{{.Status}}'
	@printf "\n$(CYAN)Homepage:$(RESET) "
	@curl -sS -o /dev/null -w 'HTTP %{http_code} in %{time_total}s\n' $(APP_URL) || true
	@printf "$(CYAN)Articles:$(RESET) "
	@$(DC) exec -T supabase-db psql -U postgres -d postgres -tA -c "SELECT COUNT(*) || ' total, ' || COUNT(*) FILTER (WHERE status='approved') || ' approved' FROM articles;" 2>/dev/null || printf "(db unreachable)\n"
	@printf "$(CYAN)Recent AI calls:$(RESET)\n"
	@$(DC) exec -T supabase-db psql -U postgres -d postgres -c "SELECT pipeline, model, COUNT(*) FROM ai_call_log WHERE created_at > now() - interval '15 minutes' GROUP BY pipeline, model ORDER BY pipeline;" 2>/dev/null || true

.PHONY: verify-isolation
verify-isolation: ## Confirm we haven't disturbed mdp_timescaledb (trading DB)
	@docker exec mdp_timescaledb pg_isready 2>&1 && printf "$(GREEN)mdp_timescaledb untouched$(RESET)\n" || printf "$(YELLOW)mdp_timescaledb not running (or never was)$(RESET)\n"

## ---------- fresh install ----------

.PHONY: fresh
fresh: ## No-cost fresh install (volumes wiped, BOOTSTRAP_RUN_AI=false)
	@printf "$(YELLOW)Wiping all volumes for fresh install...$(RESET)\n"
	$(DC) down -v
	@grep -q '^BOOTSTRAP_RUN_AI=' .env && sed -i 's/^BOOTSTRAP_RUN_AI=.*/BOOTSTRAP_RUN_AI=false/' .env || echo 'BOOTSTRAP_RUN_AI=false' >> .env
	$(DC) up -d
	@printf "$(GREEN)Fresh install started.$(RESET) Watch progress: make logs-bootstrap\n"

.PHONY: fresh-with-ai
fresh-with-ai: ## Fresh install + run full AI chain on first boot (costs $)
	@printf "$(YELLOW)Wiping all volumes for fresh install (AI chain will run — costs money)...$(RESET)\n"
	$(DC) down -v
	@grep -q '^BOOTSTRAP_RUN_AI=' .env && sed -i 's/^BOOTSTRAP_RUN_AI=.*/BOOTSTRAP_RUN_AI=true/' .env || echo 'BOOTSTRAP_RUN_AI=true' >> .env
	$(DC) up -d
	@printf "$(GREEN)Fresh install started.$(RESET) Watch progress: make logs-bootstrap\n"
