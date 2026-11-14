import type { PoolClient } from 'pg';
import type { ParsedCourseRecord } from './parsers/parsed-course-record';

export async function matchCourse(client: PoolClient, semesterId: number, record: ParsedCourseRecord) {
  const exact = await client.query<{ course_id: number; section_id: number | null }>(
    `SELECT c.course_id, s.section_id
     FROM courses c LEFT JOIN course_sections s
       ON s.course_id = c.course_id AND s.semester_id = $1 AND s.section_number = $2
     WHERE c.course_number = $3`,
    [semesterId, record.sectionNumber, record.courseNumber],
  );
  const match = exact.rows[0];
  if (match) {
    return {
      courseId: match.course_id, sectionId: match.section_id,
      status: match.section_id === null ? 'course_only' : 'matched',
    };
  }

  const candidates = await client.query(
    `SELECT DISTINCT course_id FROM course_sections
     WHERE semester_id = $1 AND btrim(course_name_snapshot) = $2
       AND ($3::text IS NULL OR section_number = $3)
     LIMIT 2`,
    [semesterId, record.courseName, record.sectionNumber],
  );
  return { courseId: null, sectionId: null, status: candidates.rows.length > 1 ? 'ambiguous' : 'unmatched' };
}
