-- City Album trading (docs/ROADMAP.md item 5 part 2): one spare card for one card, between friends. Safe to run more than once.
-- status: pending -> accepted | declined | cancelled | expired. Accepted rows move the cards in album.php's counts.
CREATE TABLE IF NOT EXISTS chinalife_album_trades (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    from_id INT UNSIGNED NOT NULL,
    to_id INT UNSIGNED NOT NULL,
    give_card VARCHAR(24) NOT NULL,
    want_card VARCHAR(24) NOT NULL,
    status VARCHAR(12) NOT NULL DEFAULT 'pending',
    created_at DATETIME NOT NULL,
    decided_at DATETIME NULL,
    PRIMARY KEY (id),
    KEY album_trades_from (from_id, status),
    KEY album_trades_to (to_id, status),
    CONSTRAINT fk_chinalife_album_trades_from FOREIGN KEY (from_id) REFERENCES users (user_id) ON DELETE CASCADE,
    CONSTRAINT fk_chinalife_album_trades_to FOREIGN KEY (to_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
