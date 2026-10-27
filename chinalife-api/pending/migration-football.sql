-- Football Field matches and tournaments (Oct 2026). NOT RUN YET.
-- Kept in pending/ on purpose so migrate.php (which globs migration-*.sql in the API folder) does not pick it up.
-- To apply after approval: back up the DB, run this file once, then switch the feature on from Admin > Football.
-- Safe to re-run: every statement is IF NOT EXISTS / INSERT IGNORE. The switch row starts OFF.
CREATE TABLE IF NOT EXISTS chinalife_football_matches (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  city VARCHAR(40) NOT NULL DEFAULT 'China',
  status ENUM('lobby','live','reported','done','disputed','cancelled') NOT NULL DEFAULT 'lobby',
  size TINYINT UNSIGNED NOT NULL DEFAULT 3,
  host_id INT NULL,
  tournament_id INT UNSIGNED NULL,
  bracket_match VARCHAR(12) NULL,
  team_a_id INT UNSIGNED NULL,
  team_b_id INT UNSIGNED NULL,
  seed INT UNSIGNED NOT NULL,
  duration_ms INT UNSIGNED NOT NULL DEFAULT 180000,
  knockout TINYINT(1) NOT NULL DEFAULT 0,
  state TEXT NULL,
  state_seq INT UNSIGNED NOT NULL DEFAULT 0,
  report TEXT NULL,
  score_a TINYINT UNSIGNED NULL,
  score_b TINYINT UNSIGNED NULL,
  winner TINYINT NULL,
  scheduled_at DATETIME NULL,
  started_at DATETIME NULL,
  reported_at DATETIME NULL,
  ended_at DATETIME NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  KEY fb_status (status, tournament_id),
  KEY fb_tournament (tournament_id, bracket_match)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chinalife_football_match_players (
  match_id INT UNSIGNED NOT NULL,
  user_id INT NOT NULL,
  team TINYINT NOT NULL DEFAULT 0,
  input VARCHAR(200) NULL,
  input_at DATETIME(3) NULL,
  confirm VARCHAR(40) NULL,
  joined_at DATETIME NOT NULL,
  left_at DATETIME NULL,
  PRIMARY KEY (match_id, user_id),
  KEY fb_user (user_id, left_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chinalife_football_tournaments (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(60) NOT NULL,
  team_size TINYINT UNSIGNED NOT NULL DEFAULT 3,
  starts_at DATETIME NOT NULL,
  max_teams TINYINT UNSIGNED NOT NULL DEFAULT 8,
  status ENUM('registering','running','done','cancelled') NOT NULL DEFAULT 'registering',
  prize_coins INT UNSIGNED NOT NULL DEFAULT 0,
  bracket MEDIUMTEXT NULL,
  champion_team_id INT UNSIGNED NULL,
  created_by INT NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  KEY fb_t_status (status, starts_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chinalife_football_tournament_teams (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tournament_id INT UNSIGNED NOT NULL,
  name VARCHAR(40) NOT NULL,
  captain_id INT NOT NULL,
  created_at DATETIME NOT NULL,
  UNIQUE KEY fb_team_name (tournament_id, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chinalife_football_tournament_members (
  tournament_id INT UNSIGNED NOT NULL,
  team_id INT UNSIGNED NOT NULL,
  user_id INT NOT NULL,
  joined_at DATETIME NOT NULL,
  PRIMARY KEY (tournament_id, user_id),
  KEY fb_member_team (team_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO chinalife_settings(name, value, updated_at) VALUES ('football_matches', '{"enabled":false}', NOW());
