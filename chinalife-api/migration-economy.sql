-- Server-authoritative coins and XP. Safe to run more than once.
-- Existing characters are copied once; later saves cannot raise these numbers.

CREATE TABLE IF NOT EXISTS chinalife_balances (
    user_id INT UNSIGNED NOT NULL,
    coins BIGINT NOT NULL DEFAULT 0,
    xp INT NOT NULL DEFAULT 0,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (user_id),
    CONSTRAINT fk_chinalife_balances_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chinalife_economy_actions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id INT UNSIGNED NOT NULL,
    action VARCHAR(24) NOT NULL,
    ref VARCHAR(80) NOT NULL,
    coins INT NOT NULL,
    xp INT NOT NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY one_economy_action (user_id, action, ref),
    KEY economy_user_time (user_id, created_at),
    CONSTRAINT fk_chinalife_economy_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO chinalife_balances (user_id, coins, xp, updated_at)
SELECT user_id,
    CAST(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(game_state, '$.money')), '0') AS SIGNED),
    GREATEST(0, CAST(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(game_state, '$.xp')), '0') AS SIGNED)),
    NOW()
FROM chinalife_saves;
