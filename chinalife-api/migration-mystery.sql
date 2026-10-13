-- City Mystery finds. The route itself lives in mystery.php; this only records verified steps.

CREATE TABLE IF NOT EXISTS chinalife_mystery_finds (
    user_id INT UNSIGNED NOT NULL,
    city VARCHAR(40) NOT NULL,
    object_id VARCHAR(40) NOT NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (user_id, city, object_id),
    CONSTRAINT fk_chinalife_mystery_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
