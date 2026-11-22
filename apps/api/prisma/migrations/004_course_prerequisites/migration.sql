-- Apply once after 003-graduation-requirements.sql.
BEGIN;

-- All required groups apply. Within each group, all or any members must qualify.
-- Seed data must ensure groups are populated and required relationships have no cycles.
CREATE TABLE course_prerequisite_groups (
  prerequisite_group_id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  department_id integer NOT NULL REFERENCES departments(department_id),
  course_id integer NOT NULL REFERENCES courses(course_id),
  group_code text NOT NULL CHECK (btrim(group_code) <> ''),
  relation_type text NOT NULL CHECK (relation_type IN ('required', 'recommended')),
  rule_type text NOT NULL CHECK (rule_type IN ('all', 'any')),
  source_ref text NOT NULL CHECK (btrim(source_ref) <> ''),
  UNIQUE (department_id, course_id, group_code),
  UNIQUE (prerequisite_group_id, course_id)
);

CREATE TABLE course_prerequisites (
  prerequisite_group_id integer NOT NULL,
  course_id integer NOT NULL,
  prerequisite_course_id integer NOT NULL REFERENCES courses(course_id),
  PRIMARY KEY (prerequisite_group_id, prerequisite_course_id),
  FOREIGN KEY (prerequisite_group_id, course_id)
    REFERENCES course_prerequisite_groups(prerequisite_group_id, course_id)
    ON DELETE CASCADE,
  CHECK (course_id <> prerequisite_course_id)
);

COMMIT;
