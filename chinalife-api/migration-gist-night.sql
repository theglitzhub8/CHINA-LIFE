-- Gist Night: anonymous posts, reactions and one poll per post. Safe to run more than once.

CREATE TABLE IF NOT EXISTS chinalife_gist_night (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id INT UNSIGNED NOT NULL,
    city VARCHAR(40) NOT NULL,
    body VARCHAR(280) NOT NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    KEY gist_night_city (city, id),
    CONSTRAINT fk_chinalife_gist_night_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chinalife_gist_night_reactions (
    post_id BIGINT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    kind VARCHAR(12) NOT NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (post_id, user_id),
    CONSTRAINT fk_chinalife_gist_night_reaction_post FOREIGN KEY (post_id) REFERENCES chinalife_gist_night (id) ON DELETE CASCADE,
    CONSTRAINT fk_chinalife_gist_night_reaction_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chinalife_gist_night_polls (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    post_id BIGINT UNSIGNED NOT NULL,
    question VARCHAR(140) NOT NULL,
    options TEXT NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY one_gist_night_poll (post_id),
    CONSTRAINT fk_chinalife_gist_night_poll_post FOREIGN KEY (post_id) REFERENCES chinalife_gist_night (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chinalife_gist_night_votes (
    poll_id BIGINT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    option_index TINYINT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (poll_id, user_id),
    CONSTRAINT fk_chinalife_gist_night_vote_poll FOREIGN KEY (poll_id) REFERENCES chinalife_gist_night_polls (id) ON DELETE CASCADE,
    CONSTRAINT fk_chinalife_gist_night_vote_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
