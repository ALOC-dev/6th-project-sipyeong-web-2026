BEGIN;

ALTER TABLE student_profiles
  ADD COLUMN expected_graduation_year integer CHECK (expected_graduation_year BETWEEN admission_year AND 9999),
  ADD COLUMN expected_graduation_term_code text CHECK (expected_graduation_term_code IN ('10', '20')),
  ADD CONSTRAINT student_profiles_expected_graduation_pair_check
    CHECK ((expected_graduation_year IS NULL) = (expected_graduation_term_code IS NULL));

COMMENT ON COLUMN student_profiles.expected_graduation_year IS
  '졸업 예정 학년도. 졸업예정학기는 마지막 이수 학기이며 실제 학위수여일과 구분한다.';
COMMENT ON COLUMN student_profiles.expected_graduation_term_code IS
  '졸업 예정 마지막 이수 학기: 10은 1학기, 20은 2학기. 학년도와 함께 입력하거나 둘 다 NULL로 둔다.';

ALTER TABLE graduation_requirements
  DROP CONSTRAINT graduation_requirements_check,
  ADD COLUMN min_volunteer_hours numeric(6,1) CHECK (min_volunteer_hours BETWEEN 0.1 AND 99999.9),
  ADD COLUMN volunteer_course_alternative boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT graduation_requirements_rule_check CHECK (
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
  ADD CONSTRAINT graduation_requirements_id_type_unique UNIQUE (requirement_id, rule_type);

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
  'When true, passing any linked graduation_requirement_courses course also satisfies volunteer. Require completed status, passing grade and grade_valid IS TRUE. Enrollment alone does not qualify. Display one satisfied status regardless of qualifying route. Seed at least one alternative course when enabled.';

COMMIT;
