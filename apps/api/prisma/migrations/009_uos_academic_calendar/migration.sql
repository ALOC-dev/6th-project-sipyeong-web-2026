CREATE TABLE academic_term_calendar (
  semester_id integer PRIMARY KEY REFERENCES semesters(semester_id),
  opens_on date NOT NULL,
  classes_end_on date NOT NULL CHECK (classes_end_on > opens_on),
  source_url text NOT NULL
);

-- University of Seoul academic calendar. The last final-exam day is the
-- class end date. Summer and winter breaks start on the following day.
INSERT INTO semesters (year, term_code) VALUES (2026, '10'), (2026, '20')
ON CONFLICT (year, term_code) DO NOTHING;

INSERT INTO academic_term_calendar (semester_id, opens_on, classes_end_on, source_url)
SELECT s.semester_id, dates.opens_on, dates.classes_end_on, 'https://www.uos.ac.kr/eng/web/uosBbs/CA1/calendar'
FROM (VALUES ('10', DATE '2026-03-03', DATE '2026-06-22'),
             ('20', DATE '2026-09-01', DATE '2026-12-21')) dates(term_code, opens_on, classes_end_on)
JOIN semesters s ON s.year = 2026 AND s.term_code = dates.term_code;
