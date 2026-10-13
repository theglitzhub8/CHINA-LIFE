-- Party Night: one dance round per club per Beijing day, then a vote and a title.

CREATE TABLE IF NOT EXISTS chinalife_party_rounds (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    city VARCHAR(40) NOT NULL,
    place VARCHAR(40) NOT NULL,
    day DATE NOT NULL,
    dance_ends DATETIME NOT NULL,
    vote_ends DATETIME NOT NULL,
    winner_id INT UNSIGNED NULL,
    title VARCHAR(80) NOT NULL DEFAULT '',
    PRIMARY KEY (id),
    UNIQUE KEY one_party_night (city, place, day)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chinalife_party_entries (
    round_id BIGINT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (round_id, user_id),
    CONSTRAINT fk_chinalife_party_entry_round FOREIGN KEY (round_id) REFERENCES chinalife_party_rounds (id) ON DELETE CASCADE,
    CONSTRAINT fk_chinalife_party_entry_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chinalife_party_votes (
    round_id BIGINT UNSIGNED NOT NULL,
    voter_id INT UNSIGNED NOT NULL,
    entry_id INT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (round_id, voter_id),
    KEY party_vote_entry (round_id, entry_id),
    CONSTRAINT fk_chinalife_party_vote_round FOREIGN KEY (round_id) REFERENCES chinalife_party_rounds (id) ON DELETE CASCADE,
    CONSTRAINT fk_chinalife_party_vote_user FOREIGN KEY (voter_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
