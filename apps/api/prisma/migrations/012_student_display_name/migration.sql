BEGIN;

ALTER TABLE student_profiles ADD COLUMN display_name text
  CHECK (display_name IS NULL OR (display_name = btrim(display_name) AND char_length(display_name) BETWEEN 1 AND 50));

COMMIT;
