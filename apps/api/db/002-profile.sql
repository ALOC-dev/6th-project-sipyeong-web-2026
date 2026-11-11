BEGIN;

ALTER TABLE app_users ADD COLUMN student_data_version integer NOT NULL DEFAULT 0;

CREATE TABLE departments (
  id text PRIMARY KEY,
  name text NOT NULL
);

INSERT INTO departments (id, name) VALUES ('computer-science', '컴퓨터과학부');

CREATE TABLE curriculum_rules (
  department_id text NOT NULL REFERENCES departments(id),
  admission_year integer NOT NULL,
  curriculum_year integer NOT NULL,
  PRIMARY KEY (department_id, admission_year, curriculum_year)
);

CREATE TABLE student_profiles (
  user_id uuid PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
  department_id text REFERENCES departments(id),
  admission_year integer CHECK (admission_year BETWEEN 2020 AND 2026),
  curriculum_year integer,
  student_number text CHECK (char_length(student_number) BETWEEN 1 AND 30),
  revision integer NOT NULL CHECK (revision > 0)
);

COMMIT;
