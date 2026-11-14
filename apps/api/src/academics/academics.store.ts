import { Injectable, OnModuleDestroy, UnprocessableEntityException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import type { PoolClient } from 'pg';
import { matchCourse } from './course-matcher';
import type { ParsedCourseRecord } from './parsers/parsed-course-record';

interface AcademicDocument {
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

  async save(userId: string, documents: AcademicDocument[]) {
    const batchId = randomUUID();
    const client = await this.database.connect();
    const semesters = new Map<string, number>();
    let saved = 0;
    try {
      await client.query('BEGIN');
      // Serialize concurrent imports for this account, including snapshot replacement.
      await client.query('SELECT id FROM app_users WHERE id = $1 FOR UPDATE', [userId]);
      for (const document of documents) {
        const result = await client.query<{ import_id: string }>(
          `INSERT INTO academic_imports
             (user_id, batch_id, document_type, file_name, file_hash, parser_version, status, committed_at)
           VALUES ($1, $2, $3, $4, $5, '1', 'committed', now()) RETURNING import_id`,
          [userId, batchId, document.type, document.name, document.hash],
        );
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
          const { year, termCode } = document.records[0];
          await client.query(
            `DELETE FROM student_course_records r
             USING academic_imports i
             WHERE r.user_id = $1 AND r.semester_id = $2 AND r.status <> 'completed'
               AND i.import_id = r.source_import_id AND i.document_type = 'enrollment_confirmation'
               AND NOT (r.course_number_snapshot = ANY($3::text[]))`,
            [userId, semesters.get(`${year}/${termCode}`), document.records.map(row => row.courseNumber)],
          );
        } 
      }
      /*
      TODO: 재업로드 로직 프론트와 합의해서 확정 후 검증 로직 구현
      이번 학기 신청 내역 전체 교체: PDF에 없는 과목도 삭제합니다. 
      저장 전에 순번이 연속인지 확인하고, 문서에 과목 수나 합계 학점이 있으면 추출 결과와 대조합니다. 
      프론트에서는 기존 신청 내역이 교체된다는 점을 안내합니다.

      PDF에 있는 과목만 갱신: 파일에서 읽은 과목만 추가하거나 수정합니다. 
      파일에 없는 과목은 남으므로, 수강 취소를 어떤 방식으로 반영할지 따로 정합니다. 
      */
      await client.query('COMMIT');
      return { batchId, parsed: documents.reduce((count, document) => count + document.records.length, 0), saved };
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
          grade_point, status, source_import_id, source_row, retake, retake_reference)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
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
         status = EXCLUDED.status,
         source_import_id = EXCLUDED.source_import_id,
         source_row = EXCLUDED.source_row,
         retake = EXCLUDED.retake,
         retake_reference = EXCLUDED.retake_reference,
         updated_at = now()
       WHERE existing.status <> 'completed' OR EXCLUDED.status = 'completed'`,
      [userId, semesterId, match.courseId, match.sectionId, match.status, row.courseNumber,
        row.courseName, row.sectionNumber, row.credits, row.category, row.grade, row.gradePoint,
        row.status, importId, JSON.stringify(row.source), row.retake, row.retakeReference],
    );
    return result.rowCount ?? 0;
  }
}
