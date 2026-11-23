import {
  ConflictException, Injectable, OnModuleDestroy, UnauthorizedException, UnprocessableEntityException,
} from '@nestjs/common';
import { Pool } from 'pg';
import type { PoolClient } from 'pg';
import { supportedDepartmentId } from './profile.dto';
import type { ExpectedGraduation, LanguageScore, ProfilePatch } from './profile.dto';
import { currentAcademicTerm, graduationAfterEightSemesters, termIndex } from '../common/academic-term';

interface Profile {
  departmentId: string;
  admissionYear: number;
  curriculumYear: number | null;
  studentNumber: string | null;
  expectedGraduation: ExpectedGraduation | null;
  studySemester: number;
  estimatedGraduation: ExpectedGraduation | null;
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
    const term = currentAcademicTerm();
    const result = await database.query<{
      profile: Omit<Profile, 'studySemester' | 'estimatedGraduation'> | null;
      studentDataVersion: number;
      curriculumPolicy: Snapshot['curriculumPolicy'];
      completedTerms: number;
    }>(
      `SELECT u.student_data_version AS "studentDataVersion",
              CASE WHEN p.user_id IS NOT NULL THEN json_build_object(
                'departmentId', p.department_id::text, 'admissionYear', p.admission_year,
                'curriculumYear', p.curriculum_year, 'studentNumber', p.student_no,
                'volunteerHours', p.volunteer_hours, 'revision', p.revision,
                'expectedGraduation', CASE WHEN p.expected_graduation_year IS NOT NULL THEN json_build_object(
                  'graduationYear', p.expected_graduation_year + CASE WHEN p.expected_graduation_term_code = '20' THEN 1 ELSE 0 END,
                  'graduationMonth', CASE WHEN p.expected_graduation_term_code = '20' THEN 2 ELSE 8 END
                ) END,
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
              END AS "curriculumPolicy",
              (SELECT count(DISTINCT s.semester_id)::int
               FROM student_course_records record JOIN semesters s USING (semester_id)
               WHERE record.user_id = u.id AND record.status = 'completed'
                 AND s.term_code IN ('10', '20') AND (s.year, s.term_code) < ($2::int, $3::text)) AS "completedTerms"
       FROM app_users u LEFT JOIN student_profiles p ON p.user_id = u.id WHERE u.id = $1`,
      [userId, term.year, term.termCode],
    );
    const snapshot = result.rows[0];
    if (!snapshot) throw new UnauthorizedException('로그인이 필요합니다.');
    const { profile, completedTerms, studentDataVersion, curriculumPolicy } = snapshot;
    if (!profile) return { profile, studentDataVersion, curriculumPolicy };
    const elapsed = termIndex(term) - profile.admissionYear * 2 + 1;
    const saved = profile.expectedGraduation;
    const remainingAfterCurrent = saved
      ? termIndex({ year: saved.graduationYear - (saved.graduationMonth === 2 ? 1 : 0),
        termCode: saved.graduationMonth === 2 ? '20' : '10' }) - termIndex(term)
      : null;
    const semester = remainingAfterCurrent === null ? (completedTerms ? completedTerms + 1 : elapsed) : 8 - remainingAfterCurrent;
    const studySemester = Math.min(8, Math.max(1, semester));
    return { studentDataVersion, curriculumPolicy, profile: { ...profile, studySemester,
      estimatedGraduation: saved ? null : graduationAfterEightSemesters(term, studySemester) } };
  }

  async departments(search: string, limit: number) {
    const result = await this.database.query<{
      departmentId: string; name: string; curriculumRules: { admissionYear: number; curriculumYear: number }[];
    }>(
      `SELECT d.department_id::text AS "departmentId", d.department_name AS name,
              COALESCE((
                SELECT json_agg(json_build_object('admissionYear', r.admission_year, 'curriculumYear', r.curriculum_year)
                                ORDER BY r.admission_year, r.curriculum_year)
                FROM curriculum_rules r WHERE r.department_id = d.department_id
              ), '[]'::json) AS "curriculumRules"
       FROM departments d
       WHERE d.department_id = $3 AND strpos(lower(d.department_name), lower($1)) > 0
       ORDER BY d.department_name, d.department_id LIMIT $2`,
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
          code: 'VALIDATION_ERROR', message: '선택한 학과와 입학연도에 적용되는 교육과정 연도를 선택해 주세요.',
        });
      }
      const studentNumber = patch.studentNumber === undefined ? profile?.studentNumber ?? null : patch.studentNumber;
      const volunteerHours = patch.volunteerHours === undefined ? profile?.volunteerHours ?? null : patch.volunteerHours;
      const graduation = patch.studySemester !== undefined
        ? graduationAfterEightSemesters(currentAcademicTerm(), patch.studySemester)
        : patch.expectedGraduation === undefined ? profile?.expectedGraduation : patch.expectedGraduation;
      if (patch.expectedGraduation &&
          (patch.expectedGraduation.graduationYear < admissionYear + 3 || patch.expectedGraduation.graduationYear > admissionYear + 12)) {
        throw new UnprocessableEntityException({
          code: 'VALIDATION_ERROR', message: '졸업 예정 시기는 입학 후 3~12년 사이로 선택해 주세요.',
        });
      }
      const lastStudyYear = graduation ? graduation.graduationYear - (graduation.graduationMonth === 2 ? 1 : 0) : null;
      const lastStudyTerm = graduation ? (graduation.graduationMonth === 2 ? '20' : '10') : null;
      if (lastStudyYear !== null && lastStudyYear < admissionYear) {
        throw new UnprocessableEntityException({
          code: 'VALIDATION_ERROR', message: '입학연도와 현재 학년·학기를 확인해 주세요.',
        });
      }
      await client.query(
        `INSERT INTO student_profiles (user_id, department_id, admission_year, curriculum_year, student_no, volunteer_hours,
           expected_graduation_year, expected_graduation_term_code, revision)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1)
         ON CONFLICT (user_id) DO UPDATE SET department_id = EXCLUDED.department_id,
           admission_year = EXCLUDED.admission_year, curriculum_year = EXCLUDED.curriculum_year,
           student_no = EXCLUDED.student_no, volunteer_hours = EXCLUDED.volunteer_hours,
           expected_graduation_year = EXCLUDED.expected_graduation_year,
           expected_graduation_term_code = EXCLUDED.expected_graduation_term_code,
           revision = student_profiles.revision + 1, updated_at = now()`,
        [userId, departmentId, admissionYear, curriculumYear, studentNumber, volunteerHours, lastStudyYear, lastStudyTerm],
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
