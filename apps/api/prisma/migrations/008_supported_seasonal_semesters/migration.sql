-- Transcript labels for seasonal sessions have no confirmed numeric portal code.
-- Use distinct internal keys for summer and winter in supported academic years.
INSERT INTO semesters (year, term_code)
SELECT academic_year.year, season.term_code
FROM (SELECT DISTINCT year FROM semesters WHERE term_code IN ('10', '20')) AS academic_year
CROSS JOIN (VALUES ('SUMMER'), ('WINTER')) AS season(term_code)
ON CONFLICT (year, term_code) DO NOTHING;
