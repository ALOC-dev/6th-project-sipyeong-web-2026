-- Apply once after 002-academic-records.sql.
BEGIN;

-- Official classifications for a student's department and admission year.
-- These codes are independent of the source labels on records and sections.
CREATE DOMAIN curriculum_category_code AS text
  CHECK (VALUE IN (
    'major_required', 'major_elective', 'general_elective',
    'liberal_required', 'liberal_elective'
  ));

CREATE TABLE course_classifications (
  department_id integer NOT NULL REFERENCES departments(department_id),
  admission_year integer NOT NULL CHECK (admission_year BETWEEN 1900 AND 9999),
  course_id integer NOT NULL REFERENCES courses(course_id),
  category_code curriculum_category_code NOT NULL,
  source_ref text NOT NULL CHECK (btrim(source_ref) <> ''),
  PRIMARY KEY (department_id, admission_year, course_id)
);

-- Seed data must ensure that admission year ranges never overlap for a department.
CREATE TABLE graduation_requirement_sets (
  requirement_set_id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  department_id integer NOT NULL REFERENCES departments(department_id),
  admission_year_from integer NOT NULL CHECK (admission_year_from BETWEEN 1900 AND 9999),
  admission_year_to integer CHECK (admission_year_to BETWEEN admission_year_from AND 9999),
  source_ref text NOT NULL CHECK (btrim(source_ref) <> ''),
  UNIQUE (department_id, admission_year_from)
);

CREATE TABLE graduation_requirements (
  requirement_id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  requirement_set_id integer NOT NULL
    REFERENCES graduation_requirement_sets(requirement_set_id) ON DELETE CASCADE,
  rule_code text NOT NULL CHECK (btrim(rule_code) <> ''),
  rule_type text NOT NULL,
  title text NOT NULL CHECK (btrim(title) <> ''),
  category_code curriculum_category_code,
  min_credits numeric(5,1) CHECK (min_credits BETWEEN 0.1 AND 9999.9),
  min_count integer CHECK (min_count > 0),
  description text,
  UNIQUE (requirement_set_id, rule_code),
  CHECK (
    (rule_type IN ('total_credits', 'course_credits')
      AND min_credits IS NOT NULL AND min_count IS NULL AND category_code IS NULL)
    OR (rule_type = 'category_credits'
      AND min_credits IS NOT NULL AND min_count IS NULL AND category_code IS NOT NULL)
    OR (rule_type = 'course_count'
      AND min_credits IS NULL AND min_count IS NOT NULL AND category_code IS NULL)
    OR (rule_type = 'manual'
      AND min_credits IS NULL AND min_count IS NULL AND category_code IS NULL
      AND description IS NOT NULL AND btrim(description) <> '')
  )
);
/* TODO : 어학 점수, 봉사활동, 학점평균, 졸업논문 등은
 논의 후 처리 방식 결정
 
 */

CREATE TABLE graduation_requirement_courses (
  requirement_id integer NOT NULL
    REFERENCES graduation_requirements(requirement_id) ON DELETE CASCADE,
  course_id integer NOT NULL REFERENCES courses(course_id),
  PRIMARY KEY (requirement_id, course_id)
);

COMMIT;
