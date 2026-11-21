import { ConflictException, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import type { LanguageScoreInput } from './student-info.dto';

@Injectable()
export class StudentInfoStore implements OnModuleDestroy {
  private readonly database = new Pool({ connectionString: process.env.DATABASE_URL });
  async onModuleDestroy() { await this.database.end(); }

  async replaceLanguageScores(userId: string, scores: LanguageScoreInput[]) {
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT id FROM app_users WHERE id = $1 FOR UPDATE', [userId]);
      await client.query('DELETE FROM student_language_scores WHERE user_id = $1', [userId]);
      for (const item of scores) {
        await client.query(
          'INSERT INTO student_language_scores(user_id, exam_type, score, grade) VALUES ($1,$2,$3,$4)',
          [userId, item.examType, item.score, item.grade],
        );
      }
      await client.query('COMMIT');
      return { scores };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }

  async updateVolunteerHours(userId: string, hours: number | null) {
    const result = await this.database.query(
      'UPDATE student_profiles SET volunteer_hours = $2, updated_at = now() WHERE user_id = $1 RETURNING user_id',
      [userId, hours],
    );
    if (!result.rowCount) throw new ConflictException('학과·학번 등 학생 기본 정보를 먼저 등록해 주세요.');
    return { volunteerHours: hours };
  }
}
