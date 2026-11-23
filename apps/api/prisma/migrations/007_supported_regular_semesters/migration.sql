-- The onboarding API accepts students admitted from 2020 through 2026.
-- Add regular terms without replacing semesters already loaded from official data.
INSERT INTO semesters (year, term_code)
SELECT academic_year, term_code
FROM generate_series(2020, 2026) AS academic_year
CROSS JOIN (VALUES ('10'), ('20')) AS regular_terms(term_code)
ON CONFLICT (year, term_code) DO NOTHING;
