-- Gossip wall replies (docs/GOSSIP-ROOM-PLAN.md Phase 2, appadmin switch gossip_wall). Safe to run more than once.
-- Replies are anonymous to players like the posts they answer; admins can trace user_id.
CREATE TABLE IF NOT EXISTS chinalife_gist_night_replies (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    post_id BIGINT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    body VARCHAR(140) NOT NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    KEY gist_reply_post (post_id, id),
    CONSTRAINT fk_chinalife_gist_reply_post FOREIGN KEY (post_id) REFERENCES chinalife_gist_night (id) ON DELETE CASCADE,
    CONSTRAINT fk_chinalife_gist_reply_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Gossip Room Phase 6: players report wall tips (one report per player per tip); 3 reports hide a tip until an admin
-- looks (chinalife_gist_night.hidden and .reports are added by migrate.php).
CREATE TABLE IF NOT EXISTS chinalife_gist_night_reports (
    post_id BIGINT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    reason VARCHAR(40) NOT NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (post_id, user_id),
    CONSTRAINT fk_chinalife_gist_report_post FOREIGN KEY (post_id) REFERENCES chinalife_gist_night (id) ON DELETE CASCADE,
    CONSTRAINT fk_chinalife_gist_report_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
