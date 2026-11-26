const assert = require('node:assert/strict');
const { readFile, readdir } = require('node:fs/promises');
const { test } = require('node:test');
const { PGlite } = require('@electric-sql/pglite');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const { AuthStore, hash } = require('../dist/auth/store');
const { ProfileStore } = require('../dist/profile/profile.store');
const { currentAcademicTerm, graduationAfterEightSemesters } = require('../dist/common/academic-term');

test('a 2026 fall sophomore completes eight semesters in February 2029', () => {
  assert.deepEqual(graduationAfterEightSemesters({ year: 2026, termCode: '20' }, 4),
    { graduationYear: 2029, graduationMonth: 2 });
  assert.deepEqual(graduationAfterEightSemesters({ year: 2026, termCode: '20' }, 3),
    { graduationYear: 2029, graduationMonth: 8 });
});

test('profile onboarding persists for the authenticated account and validates updates', async (t) => {
  process.env.DATABASE_URL = 'postgresql://test@localhost/test';
  process.env.WEB_ORIGIN = 'https://sipyeong.example';
  const database = new PGlite();
  t.after(() => database.close());
  const migrations = 'prisma/migrations';
  for (const migration of (await readdir(migrations, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name).sort()) {
    await database.exec(await readFile(migrations + '/' + migration + '/migration.sql', 'utf8'));
  }

  const app = await NestFactory.create(AppModule, { logger: false });
  t.after(() => app.close());
  const auth = app.get(AuthStore);
  const profiles = app.get(ProfileStore);
  const query = database.query.bind(database);
  await auth.database.end();
  auth.database = { query, end: async () => {} };

  // PGlite exposes one connection. Hold a transaction connection until release.
  let available = Promise.resolve();
  await profiles.database.end();
  profiles.database = {
    query,
    end: async () => {},
    async connect() {
      const next = available;
      let release;
      available = new Promise(resolve => { release = resolve; });
      await next;
      return { query, release };
    },
  };
  const token = await auth.createSession('123456789', '');
  const anotherToken = await auth.createSession('987654321', '');
  const { rows: [session] } = await database.query(
    'SELECT csrf_token FROM auth_sessions WHERE token_hash = $1', [hash(token)],
  );

  app.setGlobalPrefix('api');
  await app.listen(0, '127.0.0.1');
  const base = (await app.getUrl()) + '/api';
  const cookie = 'sipyeong_session=' + token;
  const origin = process.env.WEB_ORIGIN;
  const patch = (body, csrfToken = session.csrf_token) => fetch(base + '/users/me/profile', {
    method: 'PATCH',
    headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
    body: JSON.stringify(body),
  });
  const me = (sessionCookie = cookie) => fetch(base + '/users/me', { headers: { Cookie: sessionCookie } });

  assert.equal((await fetch(base + '/users/me')).status, 401);
  const initial = await me();
  assert.equal(initial.headers.get('cache-control'), 'private, no-store');
  const initialBody = await initial.json();
  assert.equal(initialBody.data.profile, null);
  assert.equal(initialBody.data.profileCompleted, false);
  assert.equal(initialBody.data.studentDataVersion, 0);

  const departments = await fetch(base + '/departments?q=' + encodeURIComponent('컴퓨터'), { headers: { Cookie: cookie } });
  assert.deepEqual((await departments.json()).data.items, [{ departmentId: '34', name: '컴퓨터과학부' }]);
  assert.equal((await fetch(base + '/departments?limit=0', { headers: { Cookie: cookie } })).status, 400);
  assert.equal((await patch({ expectedRevision: 0, volunteerHours: 1 })).status, 422);

  const registration = { expectedRevision: 0, departmentId: '34', admissionYear: 2023 };
  const blocked = await patch(registration, 'invalid');
  assert.equal(blocked.status, 403);
  assert.equal((await blocked.json()).error.code, 'CSRF_INVALID');

  const registered = await patch(registration);
  assert.equal(registered.status, 200);
  const details = await registered.json();
  assert.equal(details.meta.warnings, undefined);
  assert.equal(details.data.studentDataVersion, 1);
  const { studySemester, estimatedGraduation, ...registeredProfile } = details.data.profile;
  assert.deepEqual(registeredProfile, {
    departmentId: '34', admissionYear: 2023, curriculumYear: 2023, studentNumber: null,
    expectedGraduation: null, volunteerHours: null, languageScores: [], revision: 1,
  });
  assert.deepEqual(estimatedGraduation, graduationAfterEightSemesters(currentAcademicTerm(), studySemester));

  assert.equal((await patch({
    expectedRevision: 1, languageScores: [{ examType: 'TOEIC', score: 800, takenAt: '2025-02-30' }],
  })).status, 422);
  assert.equal((await patch({ expectedRevision: 1, volunteerHours: 0.15 })).status, 422);

  const scores = [
    { examType: 'TOEIC', score: 850, grade: null, takenAt: '2025-03-17' },
    { examType: 'OPIc', score: null, grade: 'IH', takenAt: null },
  ];
  assert.equal((await patch({
    expectedRevision: 1, expectedGraduation: { graduationYear: 2025, graduationMonth: 2 },
  })).status, 422);
  const expectedGraduation = { graduationYear: 2027, graduationMonth: 2 };
  const changes = { expectedRevision: 1, volunteerHours: 12.5, languageScores: scores, expectedGraduation };
  const saved = await patch(changes);
  assert.equal(saved.status, 200);
  assert.equal((await saved.json()).data.studentDataVersion, 2);
  const stale = await patch(changes);
  assert.equal(stale.status, 409);
  assert.equal((await stale.json()).error.code, 'REVISION_CONFLICT');

  const current = (await (await me()).json()).data;
  assert.equal(current.profileCompleted, true);
  assert.equal(current.profile.volunteerHours, 12.5);
  assert.deepEqual(current.profile.languageScores, scores);
  assert.deepEqual(current.profile.expectedGraduation, expectedGraduation);
  assert.equal((await (await me('sipyeong_session=' + anotherToken)).json()).data.profile, null);

  const departmentOptions = await fetch(base + '/departments', { headers: { Cookie: cookie } });
  const mappings = (await departmentOptions.json()).data.curriculumRules;
  assert.equal(mappings.length, 7);
  assert.deepEqual(mappings.find(rule => rule.admissionYear === 2023),
    { departmentId: '34', admissionYear: 2023, curriculumYear: 2023 });
  assert.equal((await patch({ expectedRevision: 2, volunteerHours: null, languageScores: [] })).status, 200);
  const cleared = await (await me()).json();
  assert.equal(cleared.data.profile.volunteerHours, null);
  assert.deepEqual(cleared.data.profile.languageScores, []);
  assert.equal(cleared.data.studentDataVersion, 3);
  assert.equal(cleared.meta.warnings, undefined);
  assert.deepEqual(cleared.data.profile.expectedGraduation, expectedGraduation);
  const august = { graduationYear: 2027, graduationMonth: 8 };
  assert.equal((await patch({ expectedRevision: 3, expectedGraduation: august })).status, 200);
  assert.deepEqual((await (await me()).json()).data.profile.expectedGraduation, august);
  assert.equal((await patch({ expectedRevision: 4, expectedGraduation: null })).status, 200);
  assert.equal((await (await me()).json()).data.profile.expectedGraduation, null);
  assert.equal((await patch({ expectedRevision: 5, studySemester: 9 })).status, 422);
  const automatic = await patch({ expectedRevision: 5, admissionYear: 2024, curriculumYear: 2025, studySemester: 4 });
  assert.equal(automatic.status, 200);
  const automaticProfile = (await automatic.json()).data.profile;
  assert.equal(automaticProfile.studySemester, 4);
  assert.equal(automaticProfile.admissionYear, 2024);
  assert.equal(automaticProfile.curriculumYear, 2024);
  assert.equal((await database.query('SELECT curriculum_year FROM student_profiles')).rows[0].curriculum_year, 2024);
  assert.deepEqual(automaticProfile.expectedGraduation, graduationAfterEightSemesters(currentAcademicTerm(), 4));
});
