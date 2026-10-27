-- Gossip hot seat: anonymous gists voted True or Cap in the Gossip Room. Safe to run more than once.
-- status: voting -> revealed; hidden (3 reports or an admin). Admin delete removes the row and its votes.

CREATE TABLE IF NOT EXISTS chinalife_hot_seat (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id INT UNSIGNED NOT NULL,
    city VARCHAR(40) NOT NULL,
    place VARCHAR(40) NOT NULL,
    body VARCHAR(140) NOT NULL,
    status VARCHAR(12) NOT NULL DEFAULT 'voting',
    day DATE NOT NULL,
    true_votes INT UNSIGNED NOT NULL DEFAULT 0,
    cap_votes INT UNSIGNED NOT NULL DEFAULT 0,
    result VARCHAR(8) NULL,
    reports INT UNSIGNED NOT NULL DEFAULT 0,
    hidden_by INT UNSIGNED NULL,
    created_at DATETIME NOT NULL,
    closes_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    KEY hot_seat_venue (city, place, status, id),
    KEY hot_seat_day (city, place, day, status),
    KEY hot_seat_moderation (status, reports),
    CONSTRAINT fk_chinalife_hot_seat_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chinalife_hot_seat_votes (
    gist_id BIGINT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    vote VARCHAR(4) NOT NULL,
    day DATE NOT NULL,
    rewarded INT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (gist_id, user_id),
    KEY hot_seat_vote_day (user_id, day, rewarded),
    CONSTRAINT fk_chinalife_hot_seat_vote_gist FOREIGN KEY (gist_id) REFERENCES chinalife_hot_seat (id) ON DELETE CASCADE,
    CONSTRAINT fk_chinalife_hot_seat_vote_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chinalife_hot_seat_reports (
    gist_id BIGINT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    reason VARCHAR(40) NOT NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (gist_id, user_id),
    CONSTRAINT fk_chinalife_hot_seat_report_gist FOREIGN KEY (gist_id) REFERENCES chinalife_hot_seat (id) ON DELETE CASCADE,
    CONSTRAINT fk_chinalife_hot_seat_report_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The admin switch. Starts on once the tables exist; admins can turn it off in Admin > Gossip hot seat.
INSERT IGNORE INTO chinalife_settings(name,value,updated_at) VALUES('hot_seat','{"enabled":true}',NOW());
