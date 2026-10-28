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
