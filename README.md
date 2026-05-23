# Commerce Analyst Agent

## Quick Start

### 1. Prepare environment

Copy the sample environment file if you do not already have a local `.env`:

```bash
cp .env.example .env
```

Update the values in `.env` for your local machine.

### 2. Start local development stack

This repo uses Docker Compose files under `compose/` and small wrapper scripts to keep commands short across Windows, Linux, and macOS.

Start the main stack on Windows CMD or PowerShell:

```bat
dev up
```

Start the main stack on Linux, macOS, Git Bash, or WSL:

```bash
./dev.sh up
```

Start the main stack plus optional tools such as Kafka UI.

Windows:

```bat
dev up-tools
```

Linux/macOS:

```bash
./dev.sh up-tools
```

Common Windows commands:

```bat
dev ps
dev logs order_service
dev restart gateway
dev config
dev build
dev down
```

Common Linux/macOS commands:

```bash
./dev.sh ps
./dev.sh logs order_service
./dev.sh restart gateway
./dev.sh config
./dev.sh build
./dev.sh down
```

### 3. Compose layout

- `compose/infra.yml`: Postgres, Kafka, Cloudflared, shared volumes, shared networks.
- `compose/app.yml`: Gateway, backend services, analytics service, frontend.
- `compose/tools.yml`: Optional tools such as Kafka UI.
- `dev.cmd`: Short commands for Windows CMD and PowerShell.
- `dev.sh`: Short commands for Linux, macOS, Git Bash, and WSL.
- `dev.ps1`: PowerShell helper kept for compatibility.
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
- Kafka UI: `http://localhost:8080` after `dev up-tools` on Windows or `./dev.sh up-tools` on Linux/macOS.

### 5. Stop containers

Stop the stack:

Windows:

```bat
dev down
```

Linux/macOS:

```bash
./dev.sh down
```

Remove volumes too if you want to wipe local data:

```powershell
docker compose --env-file .env -f compose/infra.yml -f compose/app.yml -f compose/tools.yml down -v
```
