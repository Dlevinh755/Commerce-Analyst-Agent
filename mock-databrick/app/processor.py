import pandas as pd

def process_bronze_to_silver():
    # Đọc dữ liệu thô (Amazon Books)
    df = pd.read_csv('data/bronze/amazon_books.csv')
    
    # Làm sạch dữ liệu (giả lập tầng Silver)
    df = df.dropna(subset=['Title', 'Price']) # Bỏ sách thiếu tên hoặc giá
    df['Price'] = df['Price'].astype(float)
    
    # Lưu xuống tầng Silver dưới dạng Parquet (Giống Databricks lưu Delta file)
    df.to_parquet('data/silver/books.parquet', index=False)

if __name__ == "__main__":
    process_bronze_to_silver()