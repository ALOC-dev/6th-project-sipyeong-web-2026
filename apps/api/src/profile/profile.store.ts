import { Injectable } from '@nestjs/common';
import { Database } from '../database';

export const supportedDepartmentId = '34';

export interface Profile {
  departmentId: string | null;
  admissionYear: number | null;
  curriculumYear: number | null;
  studentNumber: string | null;
  revision: number;
}

export interface ProfilePatch {
  departmentId?: string;
  admissionYear?: number;
  curriculumYear?: number;
  studentNumber?: string | null;
  expectedRevision: number;
}

interface ProfileRow extends Profile {
  studentDataVersion: number;
}

@Injectable()
export class ProfileStore {
  constructor(private readonly db: Database) {}

  async find(userId: string) {
    const result = await this.db.query<ProfileRow>(
      `SELECT department_id::text AS "departmentId", admission_year AS "admissionYear",
              curriculum_year AS "curriculumYear", student_no AS "studentNumber",
              COALESCE(revision, 0) AS revision, student_data_version AS "studentDataVersion"
       FROM users LEFT JOIN student_profiles USING (user_id) WHERE user_id = $1`,
      [userId],
    );
    const { studentDataVersion, ...profile } = result.rows[0];
    return { studentDataVersion, profile: profile.revision === 0 ? null : profile };
  }

  async departments(search: string, limit: number) {
    const result = await this.db.query<{ departmentId: string; name: string }>(
      `SELECT department_id::text AS "departmentId", department_name AS name FROM departments
       WHERE department_id = $3 AND (strpos(lower(department_name), lower($1)) > 0 OR $1 = '')
       ORDER BY department_name, department_id LIMIT $2`,
      [search, limit, supportedDepartmentId],
    );
    return result.rows;
  }

  async validateCurriculum(profile: Profile) {
    const { departmentId, admissionYear, curriculumYear } = profile;
    if (departmentId === null || admissionYear === null || curriculumYear === null) return 'incomplete';
    const result = await this.db.query<{ curriculum_year: number }>(
      `SELECT curriculum_year FROM curriculum_rules
       WHERE department_id = $1 AND admission_year = $2`,
      [departmentId, admissionYear],
    );
    if (result.rows.length === 0) return 'unknown';
    return result.rows.some((rule) => rule.curriculum_year === curriculumYear) ? 'valid' : 'invalid';
  }

  async save(userId: string, profile: Profile) {
    const result = await this.db.query<ProfileRow>(
      `WITH created AS (
         INSERT INTO student_profiles (user_id, department_id, admission_year, curriculum_year, student_no, revision)
         SELECT $1, $2, $3, $4, $5, 1 WHERE $6 = 0
         ON CONFLICT (user_id) DO NOTHING
         RETURNING *
       ), updated AS (
         UPDATE student_profiles
         SET department_id = $2, admission_year = $3, curriculum_year = $4,
             student_no = $5, revision = revision + 1
         WHERE user_id = $1 AND revision = $6 AND $6 > 0
         RETURNING *
       ), changed AS (
         SELECT * FROM created UNION ALL SELECT * FROM updated
       ), version AS (
         UPDATE users SET student_data_version = student_data_version + 1
         WHERE user_id IN (SELECT user_id FROM changed)
         RETURNING student_data_version
       )
       SELECT department_id::text AS "departmentId", admission_year AS "admissionYear",
              curriculum_year AS "curriculumYear", student_no AS "studentNumber",
              revision, student_data_version AS "studentDataVersion"
       FROM changed CROSS JOIN version`,
      [userId, profile.departmentId, profile.admissionYear, profile.curriculumYear, profile.studentNumber, profile.revision],
    );
    const row = result.rows[0];
    if (!row) return undefined;
    const { studentDataVersion, ...saved } = row;
    return { studentDataVersion, profile: saved };
  }
}
