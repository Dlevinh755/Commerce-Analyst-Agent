# Commerce Analyst Agent

## Hướng Dẫn Nhanh

### 1. Chuẩn bị môi trường

Sao chép file môi trường mẫu nếu bạn chưa có file `.env` cục bộ:

```bash
cp .env.example .env
```

Cập nhật các giá trị trong `.env` phù hợp với máy của bạn.

### 2. Khởi động môi trường phát triển local

Repo này sử dụng các file Docker Compose trong thư mục `compose/` cùng các script wrapper nhỏ để rút gọn lệnh trên Windows, Linux và macOS.

Khởi động stack chính trên Windows CMD hoặc PowerShell:

```bat
 .\dev.ps1  up hoặc (.\dev.cmd up trên CMD)
```

Khởi động stack chính trên Linux, macOS, Git Bash hoặc WSL:

```bash
./dev.sh up
```

Khởi động stack chính kèm các công cụ tùy chọn như Kafka UI.

Windows:

```bat
.\dev.ps1 up-tools
```

Linux/macOS:

```bash
./dev.sh up-tools
```

Các lệnh thường dùng trên Windows:

```bat
.\dev.ps1 ps
.\dev.ps1 logs order_service
.\dev.ps1 restart gateway
.\dev.ps1 config
.\dev.ps1 build
.\dev.ps1 down
```

Các lệnh thường dùng trên Linux/macOS:

```bash
./dev.sh ps
./dev.sh logs order_service
./dev.sh restart gateway
./dev.sh config
./dev.sh build
./dev.sh down
```

### 3. Cấu trúc Compose

- `compose/infra.yml`: Postgres, Kafka, Cloudflared, volume dùng chung, network dùng chung.
- `compose/app.yml`: Gateway, các backend service, analytics service, frontend.
- `compose/tools.yml`: Các công cụ tùy chọn như Kafka UI.
- `dev.cmd`: Lệnh rút gọn cho Windows CMD và PowerShell.
- `dev.sh`: Lệnh rút gọn cho Linux, macOS, Git Bash và WSL.
- `dev.ps1`: Script PowerShell giữ lại để tương thích.
- `docker-compose.dev.yml`: File compose dev dạng cũ (single-file), giữ lại để tương thích.
- `docker-compose.prod.yml`: Dành cho cấu hình production compose.

### 4. Endpoint local

- Gateway: `http://localhost/health`
- Frontend: `http://localhost:5175`
- Postgres: `localhost:5432`
- Auth service: `http://localhost:8000/health`
- Product service: `http://localhost:8001/books?page=1&page_size=1`
- Order service: `http://localhost:8003/health`
- Review service: `http://localhost:8006/health`
- Payout service: `http://localhost:8008/health`
- Kafka UI: `http://localhost:8080` sau khi chạy `dev up-tools` trên Windows hoặc `./dev.sh up-tools` trên Linux/macOS.

### 5. Dừng container

Dừng toàn bộ stack:

Windows:

```bat
.\dev.ps1 down
```

Linux/macOS:

```bash
./dev.sh down
```

Xóa luôn volume nếu bạn muốn làm sạch dữ liệu local:

```powershell
docker compose --env-file .env -f compose/infra.yml -f compose/app.yml -f compose/tools.yml down -v
```
