CREATE TABLE IF NOT EXISTS chinalife_presence (
 user_id INT UNSIGNED NOT NULL PRIMARY KEY,name VARCHAR(100) NOT NULL,city VARCHAR(80) NOT NULL,place VARCHAR(80) NOT NULL,color CHAR(7) NOT NULL DEFAULT '#246fa7',x DECIMAL(8,2) NOT NULL DEFAULT 0,z DECIMAL(8,2) NOT NULL DEFAULT 0,seen_at DATETIME NOT NULL,
 INDEX idx_chinalife_presence_room(city,place,seen_at),CONSTRAINT fk_chinalife_presence_user FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS chinalife_messages (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,sender_id INT UNSIGNED NOT NULL,recipient_id INT UNSIGNED NULL,city VARCHAR(80) NOT NULL,place VARCHAR(80) NOT NULL,body VARCHAR(400) NOT NULL,created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX idx_chinalife_messages_room(city,place,created_at),INDEX idx_chinalife_messages_direct(sender_id,recipient_id,created_at),CONSTRAINT fk_chinalife_messages_sender FOREIGN KEY(sender_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
