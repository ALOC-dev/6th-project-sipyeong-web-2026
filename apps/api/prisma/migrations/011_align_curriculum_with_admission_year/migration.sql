BEGIN;

WITH updated_profiles AS (
  UPDATE student_profiles
  SET curriculum_year = admission_year, revision = revision + 1, updated_at = now()
  WHERE curriculum_year IS DISTINCT FROM admission_year
  RETURNING user_id
)
UPDATE app_users
SET student_data_version = student_data_version + 1
WHERE id IN (SELECT user_id FROM updated_profiles);

COMMIT;
