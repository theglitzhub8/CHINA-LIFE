-- Stored election results: one row per ended election, written once when the election is first seen as finished.
CREATE TABLE IF NOT EXISTS chinalife_election_winners (
    election_id BIGINT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    city VARCHAR(40) NOT NULL,
    office VARCHAR(40) NOT NULL,
    votes INT UNSIGNED NOT NULL,
    decided_at DATETIME NOT NULL,
    PRIMARY KEY (election_id),
    KEY winner_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
