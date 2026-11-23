import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import type { OverviewInput, CourseRecord, Requirement } from './overview.types';
import type { AcademicTerm } from '../common/academic-term';

interface RoadmapCatalogRow {
  id: number; code: string; name: string; categoryCode: string | null; category: string | null; area: string | null; credits: number;
  offerings: { year: number; termCode: AcademicTerm['termCode']; credits: number }[];
  prerequisites: {
    relation: 'required' | 'recommended'; rule: 'all' | 'any';
    courses: { code: string; name: string }[];
  }[];
}

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

  async roadmapCatalog(departmentId: number, admissionYear: number, term: AcademicTerm, requiredCourseIds: number[]) {
    const { rows } = await this.database.query<RoadmapCatalogRow>(`
      WITH sections AS (
        SELECT DISTINCT ON (s.course_id, t.year, t.term_code)
          s.course_id, t.year, t.term_code, s.credits, s.category_name, s.category_code
        FROM course_sections s JOIN semesters t USING (semester_id)
        WHERE t.term_code IN ('10', '20') AND t.year >= $3 - 2 AND
          (s.department_id = $1 OR s.category_name IN ('교양필수', '교양선택') OR
            s.course_id = ANY($4::integer[]) OR EXISTS (
              SELECT 1 FROM course_classifications cc WHERE cc.course_id = s.course_id
                AND cc.department_id = $1 AND cc.admission_year = $2
            ))
        ORDER BY s.course_id, t.year, t.term_code, (s.department_id = $1) DESC NULLS LAST, s.section_id
      ), offerings AS (
        SELECT course_id, (array_agg(category_name ORDER BY year DESC, term_code DESC))[1] AS category,
          (array_agg(category_code ORDER BY year DESC, term_code DESC))[1] AS area,
          (array_agg(credits ORDER BY year DESC, term_code DESC))[1]::float8 AS credits,
          jsonb_agg(jsonb_build_object('year', year, 'termCode', term_code, 'credits', credits)
            ORDER BY year DESC, term_code DESC) AS terms
        FROM sections GROUP BY course_id
      ), prerequisite_groups AS (
        SELECT g.course_id, g.prerequisite_group_id, g.relation_type, g.rule_type,
          coalesce(jsonb_agg(jsonb_build_object('code', c.course_number, 'name', c.course_name)
            ORDER BY c.course_number) FILTER (WHERE c.course_id IS NOT NULL), '[]') AS courses
        FROM course_prerequisite_groups g
        LEFT JOIN course_prerequisites p USING (prerequisite_group_id, course_id)
        LEFT JOIN courses c ON c.course_id = p.prerequisite_course_id
        WHERE g.department_id = $1 GROUP BY g.prerequisite_group_id
      ), prerequisites AS (
        SELECT course_id, jsonb_agg(jsonb_build_object('relation', relation_type, 'rule', rule_type, 'courses', courses)
          ORDER BY prerequisite_group_id) AS groups
        FROM prerequisite_groups GROUP BY course_id
      )
      SELECT c.course_id AS id, c.course_number AS code, c.course_name AS name, o.category, o.area, o.credits,
        cc.category_code AS "categoryCode", o.terms AS offerings, coalesce(p.groups, '[]') AS prerequisites
      FROM offerings o JOIN courses c USING (course_id)
      LEFT JOIN course_classifications cc ON cc.course_id = c.course_id AND cc.department_id = $1 AND cc.admission_year = $2
      LEFT JOIN prerequisites p ON p.course_id = c.course_id
      ORDER BY c.course_name, c.course_number
    `, [departmentId, admissionYear, term.year, requiredCourseIds]);
    return rows;
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
        `SELECT r.*, s.year, s.term_code, cc.category_code, c.course_number AS catalog_course_number
         FROM student_course_records r JOIN semesters s USING (semester_id)
         LEFT JOIN courses c ON c.course_id = r.course_id
         LEFT JOIN student_profiles p ON p.user_id = r.user_id
         LEFT JOIN course_classifications cc ON cc.course_id = r.course_id
           AND cc.department_id = p.department_id AND cc.admission_year = p.admission_year
         WHERE r.user_id = $1 ORDER BY s.year, s.term_code, r.record_id`, [userId],
      )).rows;
      const languages = (await client.query('SELECT exam_type, score, grade FROM student_language_scores WHERE user_id = $1', [userId])).rows;
      const creditPolicy = profile ? (await client.query<NonNullable<OverviewInput['creditPolicy']>>(
        'SELECT max_liberal_credits, source_url FROM graduation_credit_policies WHERE department_id = $1',
        [profile.department_id],
      )).rows[0] ?? null : null;
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
      return { profile, records, languages, sets, requirements, creditPolicy };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }
}
