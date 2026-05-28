# Commerce Analyst Agent

Hệ thống phân tích dữ liệu thương mại điện tử đa dịch vụ (Microservices eCommerce Analytics Platform), tích hợp xử lý luồng dữ liệu thời gian thực thông qua Apache Kafka, CDC (Debezium/Kafka Connect), và lưu trữ dữ liệu thông qua S3.

---

## 📋 Mục lục
1. [Yêu cầu hệ thống](#-yêu-cầu-hệ-thống)
2. [Thiết lập môi trường](#-thiết-lập-môi-trường)
3. [Cấu trúc Docker Compose](#-cấu-trúc-docker-compose)
4. [Cách chạy hệ thống](#-cách-chạy-hệ-thống)
   - [Phương pháp 1: Sử dụng Script Helper (`dev.*`)](#phương-pháp-1-sử-dụng-script-helper-dev)
   - [Phương pháp 2: Sử dụng lệnh Docker Compose trực tiếp](#phương-pháp-2-sử-dụng-lệnh-docker-compose-trực-tiếp)
5. [Danh sách các dịch vụ & Endpoint Local](#-danh-sách-các-dịch-vụ--endpoint-local)
6. [Cơ chế tự động Seed dữ liệu](#-cơ-chế-tự-động-seed-dữ-liệu)
7. [Dọn dẹp hệ thống](#-dọn-dẹp-hệ-thống)

---

## 💻 Yêu cầu hệ thống

Trước khi bắt đầu, hãy đảm bảo máy tính của bạn đã cài đặt các công cụ sau:
- **Docker** (v20.10 trở lên)
- **Docker Compose** (v2.0.0 trở lên)
- **Git** (để quản lý mã nguồn)

---

## ⚙️ Thiết lập môi trường

Hệ thống cấu hình các tham số chạy thông qua file môi trường `.env`.

1. **Sao chép file cấu hình mẫu:**
   ```bash
   cp .env.example .env
   ```

2. **Cấu hình các biến quan trọng trong `.env`:**
   Mở file `.env` bằng trình chỉnh sửa của bạn và thiết lập các giá trị phù hợp. Một số thông số chính bao gồm:
   - Cấu hình Postgres (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`)
   - VNPay Sandbox credentials (nếu kiểm tra luồng thanh toán)
   - AWS Credentials (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME`, `S3_REGION`) dành cho việc lưu trữ CDC Sink.

---

## 🏗️ Cấu trúc Docker Compose

Để tăng tính module hóa, cấu hình docker compose được chia làm 3 file chính nằm trong thư mục [compose](file:///c:/Users/KhanhKhoa/Desktop/Documents/IUH/Nam3_K2/PTUD/Commerce-Analyst-Agent/compose):
- **[infra.yml](file:///c:/Users/KhanhKhoa/Desktop/Documents/IUH/Nam3_K2/PTUD/Commerce-Analyst-Agent/compose/infra.yml)**: Quản lý hạ tầng chung bao gồm:
  - **Postgres Database** (Lưu trữ dữ liệu microservices với WAL level = logical để hỗ trợ CDC Debezium)
  - **Kafka** & **Kafka Connect** (Gửi nhận sự kiện thời gian thực và CDC đồng bộ sang S3)
  - **Cloudflared** (Tunnel dùng để kết nối HTTPS/webhook từ ngoài vào localhost)
- **[app.yml](file:///c:/Users/KhanhKhoa/Desktop/Documents/IUH/Nam3_K2/PTUD/Commerce-Analyst-Agent/compose/app.yml)**: Chứa toàn bộ các microservices nghiệp vụ và Frontend:
  - **Gateway** (API Gateway làm trung gian điều hướng)
  - **Microservices**: Auth-service, Product-service, Cart-service, Order-service, Payment-service, Payout-service, Review-service, Recommender-service, VNPay-service, Analytics-agent.
  - **Frontend** (Giao diện ứng dụng React/Vite)
- **[tools.yml](file:///c:/Users/KhanhKhoa/Desktop/Documents/IUH/Nam3_K2/PTUD/Commerce-Analyst-Agent/compose/tools.yml)**: Chứa các công cụ hỗ trợ phát triển tùy chọn:
  - **Kafka UI** (Giao diện web trực quan để quản lý Kafka topics, consumers, và connectors)

Ngoài ra còn có:
- **[docker-compose.dev.yml](file:///c:/Users/KhanhKhoa/Desktop/Documents/IUH/Nam3_K2/PTUD/Commerce-Analyst-Agent/docker-compose.dev.yml)**: File Compose gộp duy nhất (Legacy), giữ lại để tương thích ngược.

---

## 🚀 Cách chạy hệ thống

Bạn có thể chạy hệ thống bằng một trong hai phương pháp dưới đây:

### Phương pháp 1: Sử dụng Script Helper (`dev.*`)

Chúng tôi cung cấp sẵn các script wrapper để tự động gộp các file compose phù hợp với hệ điều hành của bạn:
- **PowerShell (`.\dev.ps1`)**: Khuyến nghị cho PowerShell trên Windows.
- **Batch Command (`.\dev.cmd`)**: Dành cho Command Prompt (CMD) trên Windows.
- **Shell Script (`./dev.sh`)**: Dành cho Linux, macOS, WSL, hoặc Git Bash.

> [!NOTE]
> Trên hệ điều hành Unix (Linux/macOS), bạn cần cấp quyền thực thi cho file shell trước khi sử dụng lần đầu:
> ```bash
> chmod +x dev.sh
> ```

#### Phím tắt lệnh nhanh của Script Helper:

| Hành động | Windows (PowerShell) | Windows (CMD) | Linux / macOS / WSL | Giải thích |
| :--- | :--- | :--- | :--- | :--- |
| **Khởi động App + Infra** | `.\dev.ps1 up` | `dev.cmd up` | `./dev.sh up` | Chạy database, kafka, microservices & frontend ở chế độ nền. |
| **Khởi động kèm Công cụ** | `.\dev.ps1 up-tools` | `dev.cmd up-tools` | `./dev.sh up-tools` | Chạy App + Infra và mở thêm Kafka UI. |
| **Dừng hệ thống** | `.\dev.ps1 down` | `dev.cmd down` | `./dev.sh down` | Dừng và xóa toàn bộ container liên quan. |
| **Xem trạng thái** | `.\dev.ps1 ps` | `dev.cmd ps` | `./dev.sh ps` | Liệt kê các container đang chạy cùng tình trạng healthcheck. |
| **Xem Logs dịch vụ** | `.\dev.ps1 logs <service>` | `dev.cmd logs <service>` | `./dev.sh logs <service>` | Theo dõi log thời gian thực của một dịch vụ cụ thể. |
| **Khởi động lại dịch vụ**| `.\dev.ps1 restart <service>`| `dev.cmd restart <service>`| `./dev.sh restart <service>`| Khởi động lại nhanh một dịch vụ bị lỗi/thay đổi code. |
| **Build lại Docker Image** | `.\dev.ps1 build` | `dev.cmd build` | `./dev.sh build` | Xây dựng lại Docker image từ mã nguồn local. |
| **Kiểm tra cấu hình** | `.\dev.ps1 config` | `dev.cmd config` | `./dev.sh config` | Kiểm tra tính đúng đắn của các file compose gộp. |

*Ví dụ xem logs của dịch vụ order:*
```bash
# Trên Linux/macOS:
./dev.sh logs order_service

# Trên Windows PowerShell:
.\dev.ps1 logs order_service
```

---

### Phương pháp 2: Sử dụng lệnh Docker Compose trực tiếp

Nếu bạn không muốn sử dụng script wrapper hoặc muốn chạy trên môi trường CI/CD, bạn có thể chạy bằng cách chỉ định rõ các file compose thông qua tham số `-f`.

> [!IMPORTANT]
> Cần chỉ định đúng file `.env` qua `--env-file .env` để đảm bảo Docker Compose nạp đúng cấu hình các cổng và thông tin kết nối.

#### 1. Khởi động hệ thống (App + Hạ tầng cơ bản)
Chỉ chạy các thành phần cốt lõi và dịch vụ nghiệp vụ (không chạy Kafka UI):
```bash
docker compose --env-file .env -f compose/infra.yml -f compose/app.yml up -d
```

#### 2. Khởi động hệ thống kèm các công cụ phát triển (Kafka UI)
Chạy toàn bộ hạ tầng, dịch vụ nghiệp vụ và công cụ bổ sung:
```bash
docker compose --env-file .env -f compose/infra.yml -f compose/app.yml -f compose/tools.yml up -d
```

#### 3. Kiểm tra trạng thái các dịch vụ
Xem danh sách container cùng tình trạng hoạt động và cổng kết nối:
```bash
docker compose --env-file .env -f compose/infra.yml -f compose/app.yml -f compose/tools.yml ps
```

#### 4. Xem logs của một microservice cụ thể
Theo dõi logs theo thời gian thực (real-time stream):
```bash
docker compose --env-file .env -f compose/infra.yml -f compose/app.yml -f compose/tools.yml logs -f <tên-service-trong-compose>
```
*Ví dụ xem log của gateway hoặc auth-service:*
```bash
docker compose --env-file .env -f compose/infra.yml -f compose/app.yml logs -f gateway
docker compose --env-file .env -f compose/infra.yml -f compose/app.yml logs -f auth-service
```

#### 5. Khởi động lại một dịch vụ cụ thể
Hữu ích khi bạn chỉnh sửa mã nguồn cục bộ và muốn khởi động lại nhanh container đó:
```bash
docker compose --env-file .env -f compose/infra.yml -f compose/app.yml restart <tên-service-trong-compose>
```
*Ví dụ:* `docker compose --env-file .env -f compose/infra.yml -f compose/app.yml restart product-service`

#### 6. Build lại các Docker Image từ mã nguồn local
```bash
docker compose --env-file .env -f compose/infra.yml -f compose/app.yml build
```
Để build sạch không sử dụng cache:
```bash
docker compose --env-file .env -f compose/infra.yml -f compose/app.yml build --no-cache
```

#### 7. Dừng toàn bộ hệ thống
Dừng và giải phóng các container, mạng chung:
```bash
docker compose --env-file .env -f compose/infra.yml -f compose/app.yml -f compose/tools.yml down
```

---

## 🔌 Danh sách các dịch vụ & Endpoint Local

Sau khi khởi chạy thành công, các dịch vụ sẽ hoạt động tại các địa chỉ cục bộ sau:

| Dịch vụ | Địa chỉ truy cập Local | Cổng ngoài (External Port) | Mô tả |
| :--- | :--- | :--- | :--- |
| **API Gateway** | [http://localhost/health](http://localhost/health) | `80` (HTTP) | Điểm truy cập trung tâm cho frontend và API bên ngoài |
| **Frontend** | [http://localhost:5175](http://localhost:5175) | `5175` | Giao diện quản trị viên & người dùng |
| **Postgres DB** | `localhost:5432` | `5432` | Cơ sở dữ liệu chính lưu trữ toàn bộ microservices |
| **Auth Service** | [http://localhost:8000/health](http://localhost:8000/health) | `8000` | Quản lý đăng ký, đăng nhập và phân quyền |
| **Product Service**| [http://localhost:8001/books?page=1&page_size=1](http://localhost:8001/books?page=1&page_size=1) | `8001` | Quản lý thông tin sách/sản phẩm |
| **Cart Service** | [http://localhost:8002/health](http://localhost:8002/health) | `8002` | Quản lý giỏ hàng tạm thời và giỏ hàng người dùng |
| **Order Service** | [http://localhost:8003/health](http://localhost:8003/health) | `8003` | Xử lý đơn hàng, tích hợp gửi sự kiện Kafka |
| **Payment Service**| [http://localhost:8004/health](http://localhost:8004/health) | `8004` | Xử lý giao dịch thanh toán nội bộ |
| **VNPay Service** | [http://localhost:8005/health](http://localhost:8005/health) | `8005` | Cổng tích hợp thanh toán ngân hàng VNPay |
| **Review Service** | [http://localhost:8006/health](http://localhost:8006/health) | `8006` | Quản lý đánh giá và bình luận sản phẩm |
| **Payout Service** | [http://localhost:8008/health](http://localhost:8008/health) | `8008` | Xử lý yêu cầu đối soát và rút tiền của seller |
| **Kafka UI** | [http://localhost:8080](http://localhost:8080) | `8080` | Giao diện giám sát Kafka (Chỉ chạy khi khởi động kèm tools) |

---

## 🗄️ Cơ chế tự động Seed dữ liệu

Để hỗ trợ phát triển nhanh chóng, hệ sinh thái được tích hợp sẵn cơ chế khởi tạo dữ liệu mẫu (sách, tài khoản mẫu, lịch sử giao dịch):
- Các dịch vụ nghiệp vụ đọc file cấu hình hạt giống mẫu từ **[dev-seeds.json](file:///c:/Users/KhanhKhoa/Desktop/Documents/IUH/Nam3_K2/PTUD/Commerce-Analyst-Agent/dev-seeds.json)**.
- Khi các container khởi động lần đầu tiên, nếu cơ sở dữ liệu trống, các dịch vụ sẽ tự động thực hiện seed dữ liệu mẫu qua cấu hình biến `DEV_AUTO_SEED=true`.
- **Kafka Connect** tự động đăng ký các connectors sau 30 giây để thực hiện ghi nhận log giao dịch CDC sang S3 bucket cấu hình sẵn.

---

## 🧹 Dọn dẹp hệ thống

Để dọn dẹp sạch toàn bộ tài nguyên (bao gồm cả dữ liệu trong Database Postgres và Kafka logs lưu trên ổ đĩa):

- **Sử dụng lệnh Docker Compose trực tiếp:**
  ```bash
  docker compose --env-file .env -f compose/infra.yml -f compose/app.yml -f compose/tools.yml down -v
  ```
  > [!WARNING]
  > Lệnh `down -v` sẽ xóa hoàn toàn các volume chứa dữ liệu cơ sở dữ liệu Postgres (`postgres_data`) và Kafka (`kafka_data`). Hãy chắc chắn rằng bạn không còn thông tin quan trọng nào cần giữ lại trên local.
