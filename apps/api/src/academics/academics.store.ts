import { Injectable, OnModuleDestroy, UnprocessableEntityException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import type { PoolClient } from 'pg';
import { matchCourse } from './course-matcher';
import { academicFileName } from './academic-file-name';
import type { ParsedCourseRecord } from './parsers/parsed-course-record';
import { buildValidationSummary } from './validation-summary';

interface AcademicDocument {
  displayName?: string | null;
  type: ParsedCourseRecord['source']['documentType'];
  name: string;
  hash: string;
  records: ParsedCourseRecord[];
}

@Injectable()
export class AcademicsStore implements OnModuleDestroy {
  private readonly database = new Pool({ connectionString: process.env.DATABASE_URL });

  async onModuleDestroy() {
    await this.database.end();
  }

  async latestImports(userId: string) {
    const { rows } = await this.database.query<{
      kind: 'grades' | 'timetable'; name: string; appliedAt: Date;
    }>(`
      SELECT DISTINCT ON (document_type)
        CASE WHEN document_type = 'transcript' THEN 'grades' ELSE 'timetable' END AS kind,
        file_name AS name, committed_at AS "appliedAt"
      FROM academic_imports
      WHERE user_id = $1 AND status = 'committed'
      ORDER BY document_type, committed_at DESC, import_id DESC
    `, [userId]);
    return Object.fromEntries(rows.map(({ kind, name, appliedAt }) => [kind, { name: academicFileName(name), appliedAt }]));
  }

  async save(userId: string, documents: AcademicDocument[]) {
    const batchId = randomUUID();
    const client = await this.database.connect();
    const semesters = new Map<string, number>();
    let saved = 0;
    const imports = [];
    try {
      await client.query('BEGIN');
      // Serialize concurrent imports for this account, including snapshot replacement.
      await client.query('SELECT id FROM app_users WHERE id = $1 FOR UPDATE', [userId]);
      for (const document of documents) {
        const validationSummary = buildValidationSummary(document.type, document.records);
        const result = await client.query<{ import_id: string }>(
          `INSERT INTO academic_imports
             (user_id, batch_id, document_type, file_name, file_hash, parser_version, status, committed_at, validation_summary)
           VALUES ($1, $2, $3, $4, $5, '1', 'committed', now(), $6::jsonb) RETURNING import_id`,
          [userId, batchId, document.type, document.name, document.hash, JSON.stringify(validationSummary)],
        );
        imports.push({ importId: result.rows[0].import_id, validationSummary });
        for (const record of document.records) {
          const key = `${record.year}/${record.termCode}`;
          let semesterId = semesters.get(key);
          if (semesterId === undefined) {
            const semester = await client.query<{ semester_id: number }>(
              'SELECT semester_id FROM semesters WHERE year = $1 AND term_code = $2',
              [record.year, record.termCode],
            );
            semesterId = semester.rows[0]?.semester_id;
            if (semesterId === undefined) throw new UnprocessableEntityException(`DB에 등록되지 않은 학기입니다. (${key})`);
            semesters.set(key, semesterId);
          }
          saved += await this.saveRecord(client, userId, semesterId, result.rows[0].import_id, record);
        }
        if (document.type === 'enrollment_confirmation') {
          if (document.displayName) {
            await client.query(
              `UPDATE student_profiles SET display_name = $2, revision = revision + 1, updated_at = now()
               WHERE user_id = $1 AND display_name IS DISTINCT FROM $2`,
              [userId, document.displayName],
            );
          }
          const { year, termCode } = document.records[0];
          await client.query(
            `DELETE FROM student_course_records r
             USING academic_imports i
             WHERE r.user_id = $1 AND r.semester_id = $2 AND r.status <> 'completed'
               AND i.import_id = r.source_import_id AND i.document_type = 'enrollment_confirmation'
               AND NOT (r.course_number_snapshot = ANY($3::text[]))`,
            [userId, semesters.get(`${year}/${termCode}`), document.records.map(row => row.courseNumber)],
          );
        } else if (document.type === 'transcript') {
          // 전체성적조회 is a complete snapshot, including semesters omitted by the new file.
          // Upserts above move retained rows to this import; remove only older transcript rows.
          await client.query(
            `DELETE FROM student_course_records r
             USING academic_imports i
             WHERE r.user_id = $1 AND i.import_id = r.source_import_id
               AND i.document_type = 'transcript' AND r.source_import_id <> $2`,
            [userId, result.rows[0].import_id],
          );
        }
      }
      await client.query('UPDATE app_users SET student_data_version = student_data_version + 1 WHERE id = $1', [userId]);
      await client.query('COMMIT');
      return { batchId, parsed: documents.reduce((count, document) => count + document.records.length, 0), saved, imports };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async saveRecord(client: PoolClient, userId: string, semesterId: number, importId: string, row: ParsedCourseRecord) {
    const match = await matchCourse(client, semesterId, row);
    const result = await client.query(
      `INSERT INTO student_course_records AS existing
         (user_id, semester_id, course_id, section_id, match_status, course_number_snapshot,
          course_name_snapshot, section_number_snapshot, credits, category_snapshot, grade,
          grade_point, status, source_import_id, source_row, retake, retake_reference, grade_valid)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       ON CONFLICT (user_id, semester_id, course_number_snapshot) DO UPDATE SET
         course_id = EXCLUDED.course_id,
         section_id = CASE WHEN EXCLUDED.status = 'completed' AND EXCLUDED.course_id = existing.course_id
                           THEN existing.section_id ELSE EXCLUDED.section_id END,
         match_status = CASE WHEN EXCLUDED.status = 'completed' AND EXCLUDED.course_id = existing.course_id
                                  AND existing.section_id IS NOT NULL
                             THEN 'matched' ELSE EXCLUDED.match_status END,
         course_name_snapshot = EXCLUDED.course_name_snapshot,
         section_number_snapshot = CASE WHEN EXCLUDED.status = 'completed'
                                        THEN existing.section_number_snapshot ELSE EXCLUDED.section_number_snapshot END,
         credits = EXCLUDED.credits,
         category_snapshot = EXCLUDED.category_snapshot,
         grade = EXCLUDED.grade,
         grade_point = EXCLUDED.grade_point,
         grade_valid = EXCLUDED.grade_valid,
         status = EXCLUDED.status,
         source_import_id = EXCLUDED.source_import_id,
         source_row = EXCLUDED.source_row,
         retake = EXCLUDED.retake,
         retake_reference = EXCLUDED.retake_reference,
         updated_at = now()
       WHERE existing.status <> 'completed' OR EXCLUDED.status = 'completed'`,
      [userId, semesterId, match.courseId, match.sectionId, match.status, row.courseNumber,
        row.courseName, row.sectionNumber, row.credits, row.category, row.grade, row.gradePoint,
        row.status, importId, JSON.stringify(row.source), row.retake, row.retakeReference,
        row.source.documentType === 'transcript' ? row.gradeValid ?? null : null],
    );
    return result.rowCount ?? 0;
  }
}
