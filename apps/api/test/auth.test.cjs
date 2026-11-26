const assert = require('node:assert/strict');
const { readFile, readdir } = require('node:fs/promises');
const { test } = require('node:test');
const { PGlite } = require('@electric-sql/pglite');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const { AuthStore } = require('../dist/auth/store');
const { ProfileStore } = require('../dist/profile/profile.store');

test('Kakao signup, profile persistence across sign-ins, state replay and session logout', async (t) => {
  process.env.DATABASE_URL = 'postgresql://test@localhost/test';
  process.env.WEB_ORIGIN = 'https://sipyeong.example';
  process.env.KAKAO_REDIRECT_URI = 'https://sipyeong.example/api/auth/login/kakao/callback';
  process.env.KAKAO_REST_API_KEY = 'test-key';

  const database = new PGlite();
  t.after(() => database.close());
  const migrations = 'prisma/migrations';
  const entries = await readdir(migrations, { withFileTypes: true });
  for (const version of entries.filter(entry => entry.isDirectory()).map(entry => entry.name).sort()) {
    await database.exec(await readFile(migrations + '/' + version + '/migration.sql', 'utf8'));
  }

  const app = await NestFactory.create(AppModule, { logger: false });
  const store = app.get(AuthStore);
  const profileStore = app.get(ProfileStore);
  const query = database.query.bind(database);
  await store.database.end();
  store.database = { query, end: async () => {} };
  await profileStore.database.end();
  profileStore.database = {
    query,
    end: async () => {},
    connect: async () => ({ query, release: () => {} }),
  };
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
  const expiredNavigation = await request('login/kakao/callback', { headers: { Accept: 'text/html' } });
  assert.equal(expiredNavigation.headers.get('location'), 'https://sipyeong.example/login?reason=expired');

  const rejected = await start();
  const rejectedCallback = 'login/kakao/callback?code=rejected&state=' + rejected.state;
  const failure = await request(rejectedCallback, { headers: { Cookie: rejected.flow } });
  assert.equal(failure.status, 302);
  assert.equal(failure.headers.get('location'), 'https://sipyeong.example/login?reason=provider_error');
  assert.deepEqual((await database.query('SELECT id FROM app_users')).rows, []);
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

  const profile = (sessionCookie) => fetch(base + '/api/users/me', { headers: { Cookie: sessionCookie } });
  const unregistered = await profile(session1);
  assert.equal(unregistered.status, 200);
  assert.equal((await unregistered.json()).data.profileCompleted, false);

  const registration = {
    departmentId: '34', admissionYear: 2023, curriculumYear: 2023, studentNumber: 'TEST-1234', expectedGraduation: { graduationYear: 2027, graduationMonth: 2 },
    volunteerHours: 12.5, languageScores: [{ examType: 'TOEIC', score: 850, takenAt: '2025-03-17' }],
    expectedRevision: 0,
  };
  const registered = await fetch(base + '/api/users/me/profile', {
    method: 'PATCH',
    headers: {
      Cookie: session1, Origin: process.env.WEB_ORIGIN,
      'Content-Type': 'application/json', 'X-CSRF-Token': initial.csrfToken,
    },
    body: JSON.stringify(registration),
  });
  assert.equal(registered.status, 200);
  const saved = (await registered.json()).data;
  const { expectedRevision, languageScores, ...registeredFields } = registration;
  const { studySemester, estimatedGraduation, ...savedFields } = saved.profile;
  assert.deepEqual(savedFields, {
    displayName: null,
    ...registeredFields,
    languageScores: languageScores.map(score => ({ ...score, grade: null })),
    revision: expectedRevision + 1,
  });
  assert.ok(studySemester >= 1 && studySemester <= 8);
  assert.equal(estimatedGraduation, null);

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
  assert.deepEqual((await database.query('SELECT kakao_id FROM app_users')).rows, [
    { kakao_id: '9007199254740993' },
  ]);

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
  assert.equal((await profile(session2)).status, 401);

  const third = await start();
  const reloggedIn = await request('login/kakao/callback?code=relogin&state=' + third.state, {
    headers: { Cookie: third.flow },
  });
  assert.equal(reloggedIn.status, 302);
  const session3 = cookie(reloggedIn, 'sipyeong_session');
  assert.notEqual(session3, session2);
  const restored = await profile(session3);
  assert.equal(restored.status, 200);
  const data = (await restored.json()).data;
  assert.equal(data.userId, initial.userId);
  assert.equal(data.profileCompleted, true);
  assert.equal(data.studentDataVersion, saved.studentDataVersion);
  assert.deepEqual(data.profile, saved.profile);
  assert.deepEqual((await database.query('SELECT kakao_id FROM app_users')).rows, [
    { kakao_id: '9007199254740993' },
  ]);
});
