const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const { test } = require('node:test');
const { PGlite } = require('@electric-sql/pglite');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const { Database } = require('../dist/database');

test('Kakao signup, profile registration and session lifecycle', async (t) => {
  process.env.DATABASE_URL = 'postgresql://test@localhost/test';
  process.env.WEB_ORIGIN = 'https://sipyeong.example';
  process.env.KAKAO_REDIRECT_URI = 'https://sipyeong.example/api/auth/login/kakao/callback';
  process.env.KAKAO_REST_API_KEY = 'test-key';

  const database = new PGlite();
  t.after(() => database.close());
  await database.exec(await readFile('db/001-auth.sql', 'utf8'));
  await database.exec(await readFile('db/002-profile.sql', 'utf8'));

  const app = await NestFactory.create(AppModule, { logger: false });
  t.mock.method(app.get(Database), 'query', database.query.bind(database));
  t.after(() => app.close());
  app.setGlobalPrefix('api');
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  const realFetch = global.fetch;
  const exchangeCodes = [];
  t.mock.method(global, 'fetch', (url, options) => {
    if (url === 'https://kauth.kakao.com/oauth/token') {
      assert.equal(options.body.get('redirect_uri'), process.env.KAKAO_REDIRECT_URI);
      const code = options.body.get('code');
      exchangeCodes.push(code);
      if (code === 'rejected') return Promise.resolve(new Response(null, { status: 400 }));
      return Promise.resolve(Response.json({ access_token: 'test-token' }));
    }
    if (url === 'https://kapi.kakao.com/v2/user/me') {
      assert.equal(options.headers.Authorization, 'Bearer test-token');
      return Promise.resolve(new Response('{"id":9007199254740993}'));
    }
    return realFetch(url, options);
  });

  const request = (path, options) => fetch(base + '/api/auth/' + path, { redirect: 'manual', ...options });
  const cookie = (response, name) => {
    const header = response.headers.getSetCookie().find((value) => value.startsWith(name + '='));
    assert.match(header, /HttpOnly/);
    assert.match(header, /Secure/);
    assert.match(header, /SameSite=Lax/);
    return header.split(';')[0];
  };

  async function start() {
    const response = await request('login/kakao?returnTo=%2Fdashboard');
    assert.equal(response.status, 302);
    const location = new URL(response.headers.get('location'));
    assert.equal(location.origin, 'https://kauth.kakao.com');
    return { state: location.searchParams.get('state'), flow: cookie(response, 'sipyeong_oauth') };
  }

  const invalidTarget = await request('login/kakao?returnTo=%2F%2Fevil.example');
  assert.equal(invalidTarget.status, 400);

  const rejected = await start();
  const rejectedCallback = 'login/kakao/callback?code=rejected&state=' + rejected.state;
  const failure = await request(rejectedCallback, { headers: { Cookie: rejected.flow } });
  assert.equal(failure.status, 302);
  assert.equal(failure.headers.get('location'), 'https://sipyeong.example/login?reason=provider_error');
  assert.deepEqual((await database.query('SELECT user_id FROM users')).rows, []);
  assert.deepEqual((await database.query('SELECT user_id FROM auth_sessions')).rows, []);

  const first = await start();
  const callback = 'login/kakao/callback?code=signup&state=' + first.state;
  assert.equal((await request(callback)).status, 400);
  const signedUp = await request(callback, { headers: { Cookie: first.flow } });
  assert.equal(signedUp.status, 302);
  assert.equal(signedUp.headers.get('location'), 'https://sipyeong.example/dashboard');
  assert.equal((await request(callback, { headers: { Cookie: first.flow } })).status, 400);
  const session1 = cookie(signedUp, 'sipyeong_session');
  const sessionResponse = await request('session', { headers: { Cookie: session1 } });
  assert.equal(sessionResponse.headers.get('cache-control'), 'private, no-store');
  const initial = (await sessionResponse.json()).data;
  assert.match(initial.userId, /^[1-9]\d*$/);

  const second = await start();
  const loggedIn = await request('login/kakao/callback?code=login&state=' + second.state, {
    headers: { Cookie: second.flow + '; ' + session1 },
  });
  assert.equal(loggedIn.status, 302);
  const session2 = cookie(loggedIn, 'sipyeong_session');
  assert.notEqual(session2, session1);
  assert.equal((await request('session', { headers: { Cookie: session1 } })).status, 401);
  const current = (await (await request('session', { headers: { Cookie: session2 } })).json()).data;
  assert.equal(current.userId, initial.userId);
  assert.deepEqual((await database.query('SELECT kakao_id FROM users')).rows, [
    { kakao_id: '9007199254740993' },
  ]);

  const profileRequest = (path, options = {}) => fetch(base + '/api/' + path, options);
  const profileHeaders = {
    Cookie: session2,
    Origin: process.env.WEB_ORIGIN,
    'X-CSRF-Token': current.csrfToken,
    'Content-Type': 'application/json',
  };
  const patch = (body, headers = profileHeaders) =>
    profileRequest('users/me/profile', { method: 'PATCH', headers, body: JSON.stringify(body) });
  assert.equal((await profileRequest('users/me')).status, 401);
  const before = await profileRequest('users/me', { headers: profileHeaders });
  const empty = (await before.json()).data;
  assert.equal(empty.profile, null);
  assert.equal(empty.profileCompleted, false);

  const departments = await profileRequest('departments?q=' + encodeURIComponent('컴퓨터'), { headers: profileHeaders });
  const { departmentId } = (await departments.json()).data.items[0];
  const registration = { departmentId, admissionYear: 2024, curriculumYear: 2023, studentNumber: '2024-01', expectedRevision: 0 };
  assert.equal((await patch(registration, { ...profileHeaders, Origin: 'https://other.example' })).status, 403);
  assert.equal((await patch({ ...registration, admissionYear: 2019 })).status, 422);
  assert.equal((await patch({ ...registration, name: '추가 필드' })).status, 422);

  const created = await patch(registration);
  assert.equal(created.status, 200);
  const registered = await created.json();
  assert.equal(registered.data.profile.revision, 1);
  assert.equal(registered.data.profile.curriculumYear, 2023);
  assert.equal(registered.data.studentDataVersion, 1);
  assert.equal(registered.meta.warnings[0].code, 'CURRICULUM_POLICY_UNKNOWN');
  assert.equal((await patch(registration)).status, 409);
  const me = await profileRequest('users/me', { headers: profileHeaders });
  const meData = (await me.json()).data;
  assert.equal(meData.profileCompleted, true);
  assert.deepEqual(meData.profile, registered.data.profile);

  await database.query('INSERT INTO curriculum_rules VALUES ($1, $2, $3)', [departmentId, 2024, 2023]);
  assert.equal((await patch({ expectedRevision: 1, curriculumYear: 2024 })).status, 422);
  const cleared = await patch({ expectedRevision: 1, studentNumber: null });
  assert.equal(cleared.status, 200);
  const edited = (await cleared.json()).data;
  assert.equal(edited.profile.studentNumber, null);
  assert.equal(edited.profile.departmentId, departmentId);
  assert.equal(edited.studentDataVersion, 2);

  const competing = await Promise.all([
    patch({ expectedRevision: 2, studentNumber: 'first' }),
    patch({ expectedRevision: 2, studentNumber: 'second' }),
  ]);
  assert.deepEqual(competing.map((response) => response.status).sort(), [200, 409]);

  const cancelled = await start();
  const denied = await request('login/kakao/callback?error=access_denied&state=' + cancelled.state, {
    headers: { Cookie: cancelled.flow },
  });
  assert.equal(denied.headers.get('location'), 'https://sipyeong.example/login?reason=cancelled');
  assert.deepEqual(exchangeCodes, ['rejected', 'signup', 'login']);

  const expired = await start();
  await database.exec("UPDATE oauth_attempts SET expires_at = now() - interval '1 minute'");
  assert.equal((await request('login/kakao/callback?code=expired&state=' + expired.state, {
    headers: { Cookie: expired.flow },
  })).status, 400);

  const headers = { Cookie: session2, Origin: process.env.WEB_ORIGIN };
  assert.equal((await request('logout', { method: 'POST', headers })).status, 403);
  headers['X-CSRF-Token'] = current.csrfToken;
  assert.equal((await request('logout', { method: 'POST', headers })).status, 204);
  assert.equal((await request('session', { headers: { Cookie: session2 } })).status, 401);
});
