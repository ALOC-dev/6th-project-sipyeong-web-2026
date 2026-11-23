import { Injectable, OnModuleDestroy, UnauthorizedException } from '@nestjs/common';
import { Pool } from 'pg';
import type { GradeRow, SemesterRow } from './grade-summary';

interface GradeSnapshot {
  studentDataVersion: number;
  semester: SemesterRow | null;
  rows: GradeRow[];
}

@Injectable()
export class GradesStore implements OnModuleDestroy {
  private readonly database = new Pool({ connectionString: process.env.DATABASE_URL });

  async onModuleDestroy() {
    await this.database.end();
  }

  async read(userId: string, semesterId: string | null) {
    // One statement gives the records, selected semester and version the same snapshot.
    const result = await this.database.query<GradeSnapshot>(
      `SELECT u.student_data_version AS "studentDataVersion",
              CASE WHEN selected.semester_id IS NOT NULL THEN json_build_object(
                'semesterId', selected.semester_id::text, 'year', selected.year, 'termCode', selected.term_code
              ) END AS semester,
              COALESCE((
                SELECT json_agg(json_build_object(
                  'recordId', r.record_id::text, 'courseId', r.course_id::text,
                  'courseCode', r.course_number_snapshot, 'courseName', r.course_name_snapshot,
                  'categoryLabel', r.category_snapshot, 'credits', r.credits, 'grade', r.grade,
                  'gradePoint', r.grade_point, 'gradeValid', r.grade_valid, 'status', r.status,
                  'documentType', i.document_type,
                  'semester', json_build_object('semesterId', s.semester_id::text, 'year', s.year, 'termCode', s.term_code)
                ) ORDER BY s.year DESC,
                  CASE s.term_code WHEN 'SUMMER' THEN '15' WHEN 'WINTER' THEN '25' ELSE s.term_code END DESC,
                  s.term_code DESC, r.course_name_snapshot COLLATE "C", r.record_id)
                FROM student_course_records r
                JOIN semesters s ON s.semester_id = r.semester_id
                JOIN academic_imports i ON i.import_id = r.source_import_id AND i.user_id = r.user_id
                WHERE r.user_id = u.id AND ($2::integer IS NULL OR r.semester_id = $2::integer)
              ), '[]'::json) AS rows
       FROM app_users u LEFT JOIN semesters selected ON selected.semester_id = $2::integer
       WHERE u.id = $1`,
      [userId, semesterId],
    );
    const snapshot = result.rows[0];
    if (!snapshot) throw new UnauthorizedException('로그인이 필요합니다.');
    return snapshot;
  }
}
