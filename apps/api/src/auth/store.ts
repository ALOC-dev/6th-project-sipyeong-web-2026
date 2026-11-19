import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { Pool } from 'pg';

export const secret = () => randomBytes(32).toString('base64url');
export const hash = (value: string) => createHash('sha256').update(value).digest('hex');

@Injectable()
export class AuthStore implements OnModuleDestroy {
  protected readonly database = new Pool({ connectionString: process.env.DATABASE_URL });

  async onModuleDestroy() {
    await this.database.end();
  }

  async saveAttempt(state: string, verifier: string, returnTo: string) {
    await this.database.query(
      `INSERT INTO oauth_attempts (state_hash, verifier_hash, return_to, expires_at)
       VALUES ($1, $2, $3, now() + interval '10 minutes')`,
      [hash(state), hash(verifier), returnTo],
    );
  }

  async consumeAttempt(state: string, verifier: string): Promise<string | undefined> {
    const result = await this.database.query<{ return_to: string }>(
      `DELETE FROM oauth_attempts
       WHERE state_hash = $1 AND verifier_hash = $2 AND expires_at > now()
       RETURNING return_to`,
      [hash(state), hash(verifier)],
    );
    return result.rows[0]?.return_to;
  }

  async createSession(kakaoId: string, previousToken: string) {
    const token = secret();
    await this.database.query(
      `WITH account AS (
         INSERT INTO app_users (kakao_id) VALUES ($1)
         ON CONFLICT (kakao_id) DO UPDATE SET kakao_id = EXCLUDED.kakao_id
         RETURNING id
       ), retired AS (
         DELETE FROM auth_sessions WHERE token_hash = $2
       )
       INSERT INTO auth_sessions (token_hash, user_id, csrf_token, expires_at)
       SELECT $3, id, $4, now() + interval '7 days' FROM account`,
      [kakaoId, hash(previousToken), hash(token), secret()],
    );
    return token;
  }

  async session(token: string) {
    const result = await this.database.query<{
      userId: string;
      csrfToken: string;
      expiresAt: Date;
    }>(
      `SELECT user_id AS "userId", csrf_token AS "csrfToken", expires_at AS "expiresAt"
       FROM auth_sessions WHERE token_hash = $1 AND expires_at > now()`,
      [hash(token)],
    );
    return result.rows[0];
  }

  async logout(token: string) {
    await this.database.query('DELETE FROM auth_sessions WHERE token_hash = $1', [hash(token)]);
  }
}
