-- Hospital Phase 3 (docs/HOSPITAL-PLAN.md, appadmin switch hospital_staff): player doctors and nurses. Safe to run
-- more than once.
-- chinalife_hospital_staff: one row per player who took the Health worker test or worked a shift.
-- certified_at: passed the Health worker test (a nurse); doctors are players with a University major.
-- shift_until / seen_at: on shift until then; the queue counts only staff who looked in the last minute.
CREATE TABLE IF NOT EXISTS chinalife_hospital_staff (
    user_id INT UNSIGNED NOT NULL,
    certified_at DATETIME NULL,
    test_day DATE NULL,
    test_answers VARCHAR(2000) NULL,
    shift_until DATETIME NULL,
    seen_at DATETIME NULL,
    treated INT UNSIGNED NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id),
    KEY hospital_staff_on (shift_until, seen_at),
    CONSTRAINT fk_chinalife_hospital_staff_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- chinalife_hospital_patients: a patient asking the staff on shift. status: waiting -> treated -> done; waiting ->
-- left (gave up, or nobody came within 10 minutes). problem is the most urgent thing on their chart.
CREATE TABLE IF NOT EXISTS chinalife_hospital_patients (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id INT UNSIGNED NOT NULL,
    chart VARCHAR(400) NOT NULL,
    problem VARCHAR(12) NOT NULL,
    status VARCHAR(10) NOT NULL DEFAULT 'waiting',
    staff_id INT UNSIGNED NULL,
    treatment VARCHAR(12) NULL,
    correct TINYINT NOT NULL DEFAULT 0,
    paid INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL,
    treated_at DATETIME NULL,
    PRIMARY KEY (id),
    KEY hospital_patients_queue (status, id),
    KEY hospital_patients_user (user_id, status),
    KEY hospital_patients_staff (staff_id, treated_at),
    CONSTRAINT fk_chinalife_hospital_patient_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Hospital Phase 4 (switch hospital_visits): friends visit you while you recover on the ward and leave flowers or fruit
-- and a get-well card. seen_at is set when the patient's game collects it (the gift's effect is applied once there).
CREATE TABLE IF NOT EXISTS chinalife_hospital_visits (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    visitor_id INT UNSIGNED NOT NULL,
    patient_id INT UNSIGNED NOT NULL,
    gift VARCHAR(12) NOT NULL,
    card VARCHAR(12) NOT NULL,
    created_at DATETIME NOT NULL,
    seen_at DATETIME NULL,
    PRIMARY KEY (id),
    KEY hospital_visits_patient (patient_id, seen_at),
    KEY hospital_visits_pair (visitor_id, patient_id, created_at),
    CONSTRAINT fk_chinalife_hospital_visit_visitor FOREIGN KEY (visitor_id) REFERENCES users (user_id) ON DELETE CASCADE,
    CONSTRAINT fk_chinalife_hospital_visit_patient FOREIGN KEY (patient_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
