import {
  ConflictException, Injectable, OnModuleDestroy, UnauthorizedException, UnprocessableEntityException,
} from '@nestjs/common';
import { Pool } from 'pg';
import type { PoolClient } from 'pg';
import { supportedDepartmentId } from './profile.dto';
import type { LanguageScore, ProfilePatch } from './profile.dto';

interface Profile {
  departmentId: string;
  admissionYear: number;
  curriculumYear: number | null;
  studentNumber: string | null;
  volunteerHours: number | null;
  languageScores: LanguageScore[];
  revision: number;
}

interface Snapshot {
  profile: Profile | null;
  studentDataVersion: number;
  curriculumPolicy: 'incomplete' | 'known' | 'unknown' | 'invalid';
}

@Injectable()
export class ProfileStore implements OnModuleDestroy {
  private readonly database = new Pool({ connectionString: process.env.DATABASE_URL });

  async onModuleDestroy() {
    await this.database.end();
  }

  async find(userId: string, database: Pool | PoolClient = this.database): Promise<Snapshot> {
    const result = await database.query<Snapshot>(
      `SELECT u.student_data_version AS "studentDataVersion",
              CASE WHEN p.user_id IS NOT NULL THEN json_build_object(
                'departmentId', p.department_id::text, 'admissionYear', p.admission_year,
                'curriculumYear', p.curriculum_year, 'studentNumber', p.student_no,
                'volunteerHours', p.volunteer_hours, 'revision', p.revision,
                'languageScores', COALESCE((
                  SELECT json_agg(json_build_object('examType', exam_type, 'score', score,
                    'grade', grade, 'takenAt', taken_at) ORDER BY id)
                  FROM student_language_scores WHERE user_id = u.id
                ), '[]'::json)
              ) END AS profile,
              CASE
                WHEN p.curriculum_year IS NULL THEN 'incomplete'
                WHEN EXISTS (
                  SELECT 1 FROM curriculum_rules r WHERE r.department_id = p.department_id
                    AND r.admission_year = p.admission_year AND r.curriculum_year = p.curriculum_year
                ) THEN 'known'
                WHEN EXISTS (
                  SELECT 1 FROM curriculum_rules r WHERE r.department_id = p.department_id
                    AND r.admission_year = p.admission_year
                ) THEN 'invalid'
                ELSE 'unknown'
              END AS "curriculumPolicy"
       FROM app_users u LEFT JOIN student_profiles p ON p.user_id = u.id WHERE u.id = $1`,
      [userId],
    );
    const snapshot = result.rows[0];
    if (!snapshot) throw new UnauthorizedException('로그인이 필요합니다.');
    return snapshot;
  }

  async departments(search: string, limit: number) {
    const result = await this.database.query<{ departmentId: string; name: string }>(
      `SELECT department_id::text AS "departmentId", department_name AS name FROM departments
       WHERE department_id = $3 AND strpos(lower(department_name), lower($1)) > 0
       ORDER BY department_name, department_id LIMIT $2`,
      [search, limit, supportedDepartmentId],
    );
    return result.rows;
  }

  async save(userId: string, patch: ProfilePatch) {
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT id FROM app_users WHERE id = $1 FOR UPDATE', [userId]);
      const { profile } = await this.find(userId, client);
      if ((profile?.revision ?? 0) !== patch.expectedRevision) {
        throw new ConflictException({ code: 'REVISION_CONFLICT', message: '학적 정보가 변경되었습니다. 다시 조회해 주세요.' });
      }
      const departmentId = patch.departmentId ?? profile?.departmentId;
      const admissionYear = patch.admissionYear ?? profile?.admissionYear;
      const curriculumYear = patch.curriculumYear ?? profile?.curriculumYear;
      if (!departmentId || admissionYear === undefined || curriculumYear == null) {
        throw new UnprocessableEntityException({
          code: 'VALIDATION_ERROR', message: '학과, 입학연도, 적용 교육과정 연도를 입력해 주세요.',
        });
      }
      const { rows: rules } = await client.query<{ curriculum_year: number }>(
        'SELECT curriculum_year FROM curriculum_rules WHERE department_id = $1 AND admission_year = $2',
        [departmentId, admissionYear],
      );
      if (rules.length && !rules.some(rule => rule.curriculum_year === curriculumYear)) {
        throw new UnprocessableEntityException({
          code: 'VALIDATION_ERROR', message: '적용 교육과정 연도를 확인해 주세요.',
        });
      }
      const studentNumber = patch.studentNumber === undefined ? profile?.studentNumber ?? null : patch.studentNumber;
      const volunteerHours = patch.volunteerHours === undefined ? profile?.volunteerHours ?? null : patch.volunteerHours;
      await client.query(
        `INSERT INTO student_profiles (user_id, department_id, admission_year, curriculum_year, student_no, volunteer_hours, revision)
         VALUES ($1, $2, $3, $4, $5, $6, 1)
         ON CONFLICT (user_id) DO UPDATE SET department_id = EXCLUDED.department_id,
           admission_year = EXCLUDED.admission_year, curriculum_year = EXCLUDED.curriculum_year,
           student_no = EXCLUDED.student_no, volunteer_hours = EXCLUDED.volunteer_hours,
           revision = student_profiles.revision + 1, updated_at = now()`,
        [userId, departmentId, admissionYear, curriculumYear, studentNumber, volunteerHours],
      );
      if (patch.languageScores !== undefined) {
        await this.replaceLanguageScores(client, userId, patch.languageScores);
      }
      await client.query('UPDATE app_users SET student_data_version = student_data_version + 1 WHERE id = $1', [userId]);
      const saved = await this.find(userId, client);
      await client.query('COMMIT');
      return saved;
    } catch (error) {
      await client.query('ROLLBACK');
      if (error instanceof Error && 'constraint' in error && error.constraint === 'student_profiles_student_no_key') {
        throw new ConflictException({ code: 'STUDENT_NUMBER_IN_USE', message: '이미 등록된 학번입니다.' });
      }
      throw error;
    } finally {
      client.release();
    }
  }

  private async replaceLanguageScores(client: PoolClient, userId: string, scores: LanguageScore[]) {
    await client.query('DELETE FROM student_language_scores WHERE user_id = $1', [userId]);
    await client.query(
      `INSERT INTO student_language_scores (user_id, exam_type, score, grade, taken_at)
       SELECT $1, "examType", score, grade, "takenAt"
       FROM jsonb_to_recordset($2::jsonb) AS s("examType" text, score numeric, grade text, "takenAt" date)`,
      [userId, JSON.stringify(scores)],
    );
  }
}
