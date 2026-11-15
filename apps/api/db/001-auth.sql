BEGIN;

CREATE TABLE users (
  user_id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kakao_id varchar(255) NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE oauth_attempts (
  state_hash text PRIMARY KEY,
  verifier_hash text NOT NULL,
  return_to text NOT NULL,
  expires_at timestamptz NOT NULL
);

CREATE TABLE auth_sessions (
  token_hash text PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  csrf_token text NOT NULL,
  expires_at timestamptz NOT NULL
);

CREATE INDEX oauth_attempts_expiry_idx ON oauth_attempts (expires_at);
CREATE INDEX auth_sessions_expiry_idx ON auth_sessions (expires_at);

COMMIT;
