ALTER TABLE books ADD COLUMN IF NOT EXISTS purchase_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE books ADD COLUMN IF NOT EXISTS rating_avg NUMERIC(3,2) NOT NULL DEFAULT 0;
ALTER TABLE books ADD COLUMN IF NOT EXISTS rating_count INTEGER NOT NULL DEFAULT 0;

UPDATE books SET purchase_count = 0 WHERE purchase_count IS NULL;
UPDATE books SET rating_avg = 0 WHERE rating_avg IS NULL;
UPDATE books SET rating_count = 0 WHERE rating_count IS NULL;
