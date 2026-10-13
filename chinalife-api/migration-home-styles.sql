-- v8 home customisation: the floor and wallpaper chosen for each home, and the styles a player has bought.
CREATE TABLE IF NOT EXISTS chinalife_home_styles (
    user_id INT UNSIGNED NOT NULL,
    home_key VARCHAR(120) NOT NULL,
    floor VARCHAR(24) NOT NULL DEFAULT 'default',
    wall VARCHAR(24) NOT NULL DEFAULT 'default',
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (user_id, home_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS chinalife_home_style_unlocks (
    user_id INT UNSIGNED NOT NULL,
    style VARCHAR(32) NOT NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (user_id, style)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
