BEGIN;

CREATE TABLE app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kakao_id text NOT NULL UNIQUE
);

CREATE TABLE oauth_attempts (
  state_hash text PRIMARY KEY,
  verifier_hash text NOT NULL,
  return_to text NOT NULL,
  expires_at timestamptz NOT NULL
);

CREATE TABLE auth_sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  csrf_token text NOT NULL,
  expires_at timestamptz NOT NULL
);

CREATE INDEX oauth_attempts_expiry_idx ON oauth_attempts (expires_at);
CREATE INDEX auth_sessions_expiry_idx ON auth_sessions (expires_at);

COMMIT;
