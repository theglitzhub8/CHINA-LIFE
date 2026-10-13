-- City Hall elections. One row per election; one vote per player inside that election.
-- The older chinalife_politics_votes table is left as it is.

CREATE TABLE IF NOT EXISTS chinalife_elections (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    city VARCHAR(40) NOT NULL,
    office VARCHAR(40) NOT NULL,
    starts_at DATETIME NOT NULL,
    ends_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    KEY election_office (city, office, ends_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chinalife_election_votes (
    election_id BIGINT UNSIGNED NOT NULL,
    voter_id INT UNSIGNED NOT NULL,
    candidate_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (election_id, voter_id),
    KEY election_candidate (election_id, candidate_id),
    CONSTRAINT fk_chinalife_election_vote_election FOREIGN KEY (election_id) REFERENCES chinalife_elections (id) ON DELETE CASCADE,
    CONSTRAINT fk_chinalife_election_vote_user FOREIGN KEY (voter_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
