-- 1. Tạo các kiểu dữ liệu ENUM cho trạng thái và phân quyền
CREATE TYPE user_role AS ENUM ('buyer', 'seller', 'admin');
CREATE TYPE order_status AS ENUM ('pending', 'processing', 'shipped', 'delivered', 'cancelled');
CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');

-- 2. Bảng Users (Người dùng)
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role user_role NOT NULL DEFAULT 'buyer',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Bảng Categories (Danh mục)
CREATE TABLE categories (
    category_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT
);

-- 4. Bảng Books (Sách)
CREATE TABLE books (
    book_id SERIAL PRIMARY KEY,
    seller_id INT NOT NULL,
    category_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    author VARCHAR(150) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
    stock_quantity INT NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    image_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (seller_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE SET NULL
);

-- 5. Bảng Orders (Đơn hàng)
CREATE TABLE orders (
    order_id SERIAL PRIMARY KEY,
    buyer_id INT NOT NULL,
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_amount DECIMAL(10, 2) NOT NULL CHECK (total_amount >= 0),
    shipping_address TEXT NOT NULL,
    status order_status NOT NULL DEFAULT 'pending',
    FOREIGN KEY (buyer_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 6. Bảng Order_Items (Chi tiết đơn hàng)
CREATE TABLE order_items (
    order_item_id SERIAL PRIMARY KEY,
    order_id INT NOT NULL,
    book_id INT NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10, 2) NOT NULL CHECK (unit_price >= 0),
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
    FOREIGN KEY (book_id) REFERENCES books(book_id) ON DELETE RESTRICT
);

-- 7. Bảng Cart (Giỏ hàng)
CREATE TABLE cart (
    cart_id SERIAL PRIMARY KEY,
    buyer_id INT NOT NULL,
    book_id INT NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    FOREIGN KEY (buyer_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (book_id) REFERENCES books(book_id) ON DELETE CASCADE,
    UNIQUE (buyer_id, book_id) -- Đảm bảo một sách chỉ có 1 dòng trong giỏ của 1 user
);

-- 8. Bảng Reviews (Đánh giá)
CREATE TABLE reviews (
    review_id SERIAL PRIMARY KEY,
    book_id INT NOT NULL,
    buyer_id INT NOT NULL,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
FOREIGN KEY (book_id) REFERENCES books(book_id) ON DELETE CASCADE,
    FOREIGN KEY (buyer_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 9. Bảng Payments (Thanh toán)
CREATE TABLE payments (
    payment_id SERIAL PRIMARY KEY,
    order_id INT NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    payment_status payment_status NOT NULL DEFAULT 'pending',
    amount DECIMAL(10, 2) NOT NULL CHECK (amount >= 0),
    transaction_code VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
);