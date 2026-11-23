import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import type { OverviewInput, CourseRecord, Requirement } from './overview.types';
import type { AcademicTerm } from '../common/academic-term';

@Injectable()
export class OverviewStore implements OnModuleDestroy {
  private readonly database = new Pool({ connectionString: process.env.DATABASE_URL });
  async onModuleDestroy() { await this.database.end(); }

  async calendar(term: AcademicTerm) {
    const { rows } = await this.database.query<{ opensOn: string; classesEndOn: string; sourceUrl: string }>(
      `SELECT opens_on::text AS "opensOn", classes_end_on::text AS "classesEndOn", source_url AS "sourceUrl"
       FROM academic_term_calendar JOIN semesters USING (semester_id)
       WHERE year = $1 AND term_code = $2`,
      [term.year, term.termCode],
    );
    return rows[0] ?? null;
  }

  async load(userId: string): Promise<OverviewInput> {
    const client = await this.database.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const profile = (await client.query(
        `SELECT p.*, d.department_name FROM student_profiles p
         JOIN departments d USING (department_id) WHERE user_id = $1`, [userId],
      )).rows[0] ?? null;
      const records = (await client.query<CourseRecord>(
        `SELECT r.*, s.year, s.term_code, cc.category_code
         FROM student_course_records r JOIN semesters s USING (semester_id)
         LEFT JOIN student_profiles p ON p.user_id = r.user_id
         LEFT JOIN course_classifications cc ON cc.course_id = r.course_id
           AND cc.department_id = p.department_id AND cc.admission_year = p.admission_year
         WHERE r.user_id = $1 ORDER BY s.year, s.term_code, r.record_id`, [userId],
      )).rows;
      const languages = (await client.query('SELECT exam_type, score, grade FROM student_language_scores WHERE user_id = $1', [userId])).rows;
      const sets = profile ? (await client.query(
        `SELECT * FROM graduation_requirement_sets WHERE department_id = $1
         AND admission_year_from <= $2 AND (admission_year_to IS NULL OR admission_year_to >= $2)`,
        [profile.department_id, profile.admission_year],
      )).rows : [];
      const requirements = sets.length === 1 ? (await client.query<Requirement>(
        `SELECT r.*,
         COALESCE((SELECT jsonb_agg(jsonb_build_object('course_id',c.course_id,
           'course_number',c.course_number,'course_name',c.course_name))
           FROM graduation_requirement_courses rc JOIN courses c USING(course_id)
           WHERE rc.requirement_id = r.requirement_id), '[]') AS courses,
         COALESCE((SELECT jsonb_agg(jsonb_build_object('exam_type',o.exam_type,
           'min_score',o.min_score,'accepted_grade',o.accepted_grade))
           FROM graduation_language_options o WHERE o.requirement_id = r.requirement_id), '[]') AS options
         FROM graduation_requirements r WHERE requirement_set_id = $1 ORDER BY requirement_id`,
        [sets[0].requirement_set_id],
      )).rows : [];
      await client.query('COMMIT');
      return { profile, records, languages, sets, requirements };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }
}
