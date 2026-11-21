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
  min_volunteer_hours numeric(6,1) CHECK (min_volunteer_hours BETWEEN 0.1 AND 99999.9),
  volunteer_course_alternative boolean NOT NULL DEFAULT false,
  description text,
  UNIQUE (requirement_set_id, rule_code),
  CONSTRAINT graduation_requirements_rule_check CHECK (
    (
      min_volunteer_hours IS NULL AND NOT volunteer_course_alternative
      AND (
        (rule_type IN ('total_credits', 'course_credits')
          AND min_credits IS NOT NULL AND min_count IS NULL AND category_code IS NULL)
        OR (rule_type = 'category_credits'
          AND min_credits IS NOT NULL AND min_count IS NULL AND category_code IS NOT NULL)
        OR (rule_type = 'course_count'
          AND min_credits IS NULL AND min_count IS NOT NULL AND category_code IS NULL)
        OR (rule_type = 'manual'
          AND min_credits IS NULL AND min_count IS NULL AND category_code IS NULL
          AND description IS NOT NULL AND btrim(description) <> '')
        OR (rule_type = 'language_certification'
          AND min_credits IS NULL AND min_count IS NULL AND category_code IS NULL)
      )
    )
    OR (
      rule_type = 'volunteer' AND min_volunteer_hours IS NOT NULL
      AND min_credits IS NULL AND min_count IS NULL AND category_code IS NULL
    )
  ),
  CONSTRAINT graduation_requirements_id_type_unique UNIQUE (requirement_id, rule_type)
);

CREATE TABLE graduation_requirement_courses (
  requirement_id integer NOT NULL
    REFERENCES graduation_requirements(requirement_id) ON DELETE CASCADE,
  course_id integer NOT NULL REFERENCES courses(course_id),
  PRIMARY KEY (requirement_id, course_id)
);

-- Any one matching option satisfies the language certification requirement.
-- Numeric exams use min_score. Grade-based exams enumerate accepted grades as rows.
CREATE TABLE graduation_language_options (
  option_id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  requirement_id integer NOT NULL,
  rule_type text NOT NULL DEFAULT 'language_certification'
    CHECK (rule_type = 'language_certification'),
  exam_type text NOT NULL CHECK (btrim(exam_type) <> ''),
  min_score numeric CHECK (min_score >= 0 AND min_score < 'Infinity'::numeric),
  accepted_grade text CHECK (btrim(accepted_grade) <> ''),
  FOREIGN KEY (requirement_id, rule_type)
    REFERENCES graduation_requirements(requirement_id, rule_type) ON DELETE CASCADE,
  CHECK ((min_score IS NOT NULL AND accepted_grade IS NULL)
    OR (min_score IS NULL AND accepted_grade IS NOT NULL)),
  UNIQUE NULLS NOT DISTINCT (requirement_id, exam_type, min_score, accepted_grade)
);

COMMENT ON TABLE graduation_language_options IS
  'Match exam_type with student_language_scores. Any numeric score >= min_score or exact accepted_grade qualifies. Seed at least one option per language requirement.';
COMMENT ON COLUMN graduation_requirements.min_volunteer_hours IS
  'Required service hours compared with student_profiles.volunteer_hours. NULL student hours mean not submitted.';
COMMENT ON COLUMN graduation_requirements.volunteer_course_alternative IS
  'When true, passing any linked graduation_requirement_courses course also satisfies volunteer. Require completed status, passing grade and grade_valid IS DISTINCT FROM false. Enrollment alone does not qualify. Display one satisfied status regardless of qualifying route. Seed at least one alternative course when enabled.';

COMMIT;
