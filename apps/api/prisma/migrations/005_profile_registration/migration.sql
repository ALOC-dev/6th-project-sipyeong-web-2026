BEGIN;

ALTER TABLE app_users ADD COLUMN student_data_version integer NOT NULL DEFAULT 0;
ALTER TABLE student_profiles
  ALTER COLUMN student_no DROP NOT NULL,
  ADD COLUMN curriculum_year integer CHECK (curriculum_year BETWEEN 1900 AND 9999),
  ADD COLUMN revision integer NOT NULL DEFAULT 1 CHECK (revision > 0);

INSERT INTO departments (department_id, department_name)
VALUES (34, '컴퓨터과학부')
ON CONFLICT (department_id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('departments', 'department_id'),
              GREATEST((SELECT max(department_id) FROM departments),
                       (SELECT last_value FROM departments_department_id_seq)));

CREATE TABLE curriculum_rules (
  department_id integer NOT NULL REFERENCES departments(department_id),
  admission_year integer NOT NULL CHECK (admission_year BETWEEN 1900 AND 9999),
  curriculum_year integer NOT NULL CHECK (curriculum_year BETWEEN 1900 AND 9999),
  PRIMARY KEY (department_id, admission_year, curriculum_year)
);

COMMIT;
