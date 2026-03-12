from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi
from .db import Base, engine
from .routers import auth

app = FastAPI(
    title="Auth Service",
    version="1.0.0",
    description=(
        "## Dịch vụ xác thực người dùng\n\n"
        "Cung cấp các chức năng:\n"
        "- **Đăng ký** tài khoản mới với phân quyền theo role\n"
        "- **Đăng nhập** và cấp phát JWT Access Token\n"
        "- **Xác thực** token và lấy thông tin người dùng hiện tại\n"
        "- **Phân quyền** theo role: `buyer`, `seller`, `admin`\n\n"
        "### Cách dùng Bearer Token\n"
        "Sau khi login, copy `access_token` rồi click **Authorize** (🔒) ở trên, "
        "nhập: `Bearer <token>`"
    ),
    docs_url="/docs",
    redoc_url="/redoc",
)

# Chỉ dùng khi bạn muốn tự tạo bảng từ ORM.
# Nếu DB đã được tạo sẵn bằng script SQL rồi thì có thể bỏ dòng này.
Base.metadata.create_all(bind=engine)

app.include_router(auth.router)


@app.get("/health", tags=["System"], summary="Kiểm tra trạng thái service")
def health_check():
    """Trả về trạng thái hoạt động của Auth Service. Dùng để health-check từ gateway hoặc monitoring."""
    return {"status": "ok", "service": "auth"}


def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
    )
    schema["components"]["securitySchemes"] = {
        "BearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
            "description": "Nhập JWT token nhận được từ **/auth/login**",
        }
    }
    for path in schema.get("paths", {}).values():
        for operation in path.values():
            operation.setdefault("security", [{"BearerAuth": []}])
    app.openapi_schema = schema
    return schema


app.openapi = custom_openapi