## 🚀 Quick Start

### 1. Cài đặt môi trường

Sao chép cấu hình mẫu và điền các thông tin cần thiết:

**Bash**

```
cp .env.example .env
```

### 2. Khởi chạy với Docker

#### **Môi trường Phát triển (Development)**

Dùng để code và debug trực tiếp (có mở port DB 5432, 27017 và pgAdmin):

**Bash**

```
docker-compose -f docker-compose.dev.yml up -d
```

* **Postgres:** `localhost:5432`
* **MongoDB:** `localhost:27017`
* **pgAdmin:** `http://localhost:8080`

#### **Môi trường Triển khai (Production)**

Chỉ kéo Image đã đóng gói từ Registry (không build code tại chỗ):

**Bash**

```
# Đăng nhập và kéo image mới nhất
docker compose -f docker-compose.prod.yml pull

# Chạy hệ thống
docker compose -f docker-compose.prod.yml up -d
```

### 3. Cấu trúc dự án

* `docker-compose.yml`: Cấu hình nền tảng chung.
* `docker-compose.dev.yml`: Cấu hình mở rộng cho Local Dev.
* `docker-compose.prod.yml`: Cấu hình tối ưu cho Production (Image-based).
* `.gitkeep`: Đảm bảo cấu trúc thư mục rỗng được giữ vững trên GitHub.

### 4. Dọn dẹp

Để dừng và xóa toàn bộ container:

**Bash**

```
docker compose down
```

*(Thêm flag `-v` nếu bạn muốn xóa sạch dữ liệu trong Volumes).*
