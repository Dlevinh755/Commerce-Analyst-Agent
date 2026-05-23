# Commerce Analyst Agent

## Quick Start

### 1. Prepare environment

Copy the sample environment file if you do not already have a local `.env`:

```bash
cp .env.example .env
```

Update the values in `.env` for your local machine.

### 2. Start local development stack

This repo uses Docker Compose files under `compose/` and a root `Makefile` to keep commands short.

Start the main stack:

```bash
make up
```

Start the main stack plus optional tools such as Kafka UI:

```bash
make up-tools
```

Common commands:

```bash
make ps
make logs SERVICE=order_service
make restart SERVICE=gateway
make config
make build
make down
```

If you are on Windows and do not have `make`, use Git Bash, WSL, Chocolatey, Scoop, or install GNU Make.

### 3. Compose layout

- `compose/infra.yml`: Postgres, Kafka, Cloudflared, shared volumes, shared networks.
- `compose/app.yml`: Gateway, backend services, analytics service, frontend.
- `compose/tools.yml`: Optional tools such as Kafka UI.
- `Makefile`: Short commands for local development.
- `docker-compose.dev.yml`: Legacy single-file dev compose kept for compatibility.
- `docker-compose.prod.yml`: Reserved for production compose configuration.

### 4. Local endpoints

- Gateway: `http://localhost/health`
- Frontend: `http://localhost:5175`
- Postgres: `localhost:5432`
- Auth service: `http://localhost:8000/health`
- Product service: `http://localhost:8001/books?page=1&page_size=1`
- Order service: `http://localhost:8003/health`
- Review service: `http://localhost:8006/health`
- Payout service: `http://localhost:8008/health`
- Kafka UI: `http://localhost:8080` after `make up-tools`

### 5. Stop containers

Stop the stack:

```bash
make down
```

Remove volumes too if you want to wipe local data:

```bash
docker compose --env-file .env -f compose/infra.yml -f compose/app.yml -f compose/tools.yml down -v
```
