import { ConflictException, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import type { PoolClient } from 'pg';
import type { LanguageScoreInput } from './student-info.dto';

@Injectable()
export class StudentInfoStore implements OnModuleDestroy {
  private readonly database = new Pool({ connectionString: process.env.DATABASE_URL });

  async onModuleDestroy() {
    await this.database.end();
  }

  async replaceLanguageScores(userId: string, scores: LanguageScoreInput[]) {
    await this.updateProfile(userId, async (client) => {
      await client.query('DELETE FROM student_language_scores WHERE user_id = $1', [userId]);
      await client.query(
        `INSERT INTO student_language_scores (user_id, exam_type, score, grade)
         SELECT $1, "examType", score, grade
         FROM jsonb_to_recordset($2::jsonb) AS s("examType" text, score numeric, grade text)`,
        [userId, JSON.stringify(scores)],
      );
    });
    return { scores };
  }

  async updateVolunteerHours(userId: string, hours: number | null) {
    await this.updateProfile(userId, async (client) => {
      await client.query('UPDATE student_profiles SET volunteer_hours = $2 WHERE user_id = $1', [userId, hours]);
    });
    return { volunteerHours: hours };
  }

  private async updateProfile(userId: string, update: (client: PoolClient) => Promise<void>) {
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT id FROM app_users WHERE id = $1 FOR UPDATE', [userId]);
      const profile = await client.query(
        'UPDATE student_profiles SET revision = revision + 1, updated_at = now() WHERE user_id = $1 RETURNING user_id',
        [userId],
      );
      if (!profile.rowCount) {
        throw new ConflictException('학과·학번 등 학생 기본 정보를 먼저 등록해 주세요.');
      }
      await update(client);
      await client.query('UPDATE app_users SET student_data_version = student_data_version + 1 WHERE id = $1', [userId]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
