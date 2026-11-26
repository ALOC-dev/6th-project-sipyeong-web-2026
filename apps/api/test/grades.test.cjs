const assert = require('node:assert/strict');
const { readFile, readdir } = require('node:fs/promises');
const { test } = require('node:test');
const { PGlite } = require('@electric-sql/pglite');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const { AcademicsStore } = require('../dist/academics/academics.store');
const { AuthStore } = require('../dist/auth/store');
const { GradesStore } = require('../dist/grades/grades.store');

test('grades persist validity and aggregate all matching records for the signed-in account', async (t) => {
  process.env.DATABASE_URL = 'postgresql://test@localhost/test';
  const database = new PGlite();
  const migrations = 'prisma/migrations';
  const migrationDirs = (await readdir(migrations, { withFileTypes: true })).filter(entry => entry.isDirectory());
  for (const { name } of migrationDirs.sort((a, b) => a.name.localeCompare(b.name))) {
    await database.exec(await readFile(migrations + '/' + name + '/migration.sql', 'utf8'));
  }
  const { rows: semesters } = await database.query(
    "SELECT semester_id::text, year, term_code FROM semesters WHERE year IN (2024, 2025)",
  );
  const semester = (year, termCode) => semesters.find(row => row.year === year && row.term_code === termCode).semester_id;
  const spring = 'semesters/' + semester(2024, '10');

  const app = await NestFactory.create(AppModule, { logger: false });
  t.after(async () => {
    await app.close();
    await database.close();
  });
  const query = database.query.bind(database);
  const db = { query, end: async () => {}, connect: async () => ({ query, release: () => {} }) };
  for (const store of [AuthStore, AcademicsStore, GradesStore]) {
    const provider = app.get(store);
    await provider.database.end();
    provider.database = db;
  }
  const auth = app.get(AuthStore);
  const academics = app.get(AcademicsStore);
  const token = await auth.createSession('7654321', '');
  const otherToken = await auth.createSession('7654322', '');
  const { userId } = await auth.session(token);
  const { userId: otherId } = await auth.session(otherToken);

  const row = (courseNumber, category, credits, grade, gradePoint, gradeValid, termCode = '10') => ({
    year: 2024, termCode, courseNumber, courseName: courseNumber, sectionNumber: null, category,
    credits, grade, gradePoint, gradeValid, status: 'completed', retake: null, retakeReference: null,
    source: { documentType: 'transcript', row: 2 },
  });
  const transcript = (records) => ({ type: 'transcript', name: 'test.xlsx', hash: 'a'.repeat(64), records });
  const general = row('C-GENERAL', '교양선택', 1, 'B0', 3, true, '20');
  const transcriptRows = [
    row('A-MAJOR', '전공필수', 3, 'A+', 4.5, true),
    row('B-FAIL', '전공선택', 2, 'F0', 0, true),
    general,
    row('D-PASS', '교양필수', 1, 'S', null, true),
    row('E-INVALID', '전공선택', 3, 'A+', 4.5, false),
    row('F-U', '미분류', 1, 'U', null, true, '20'),
  ];
  await academics.save(userId, [transcript(transcriptRows), {
    type: 'enrollment_confirmation', name: 'test.pdf', hash: 'b'.repeat(64),
    records: [{
      ...row('G-ENROLLED', null, 2, null, null, null, '20'), status: 'enrolled',
      source: { documentType: 'enrollment_confirmation', row: 2 },
    }],
  }]);
  await academics.save(otherId, [transcript([row('PRIVATE', '교양선택', 3, 'D0', 1, true)])]);

  app.setGlobalPrefix('api');
  await app.listen(0, '127.0.0.1');
  const base = (await app.getUrl()) + '/api/grades/';
  const get = (route, session = token) => fetch(base + route, {
    headers: session === null ? {} : { Cookie: 'sipyeong_session=' + session },
  });

  assert.equal((await get('summary', null)).status, 401);
  assert.equal((await get('summary?category=invented')).status, 400);
  assert.equal((await get('semesters/9999')).status, 404);
  const empty = (await (await get('semesters/' + semester(2025, '10'))).json()).data;
  assert.deepEqual(empty.items, []);
  assert.equal(empty.summary.earnedCredits, 0);
  assert.equal(empty.summary.gpa, null);

  const summary = (await (await get('summary')).json()).data;
  assert.equal(summary.earnedCredits, 5);
  assert.equal(summary.enrolledCredits, 2);
  assert.equal(summary.gpa, 2.75);
  assert.deepEqual(summary.gpaBasis, { gpaCredits: 6, gradePoints: 16.5 });
  assert.ok(["10", "20"].includes(summary.currentTerm.termCode));
  assert.equal(summary.requiredCredits, null);
  assert.equal(summary.byCategory.find(item => item.category === 'UNCLASSIFIED').enrolledCredits, 2);
  const major = (await (await get('summary?category=MAJOR')).json()).data;
  assert.equal(major.earnedCredits, 3);
  assert.equal(major.gpa, 2.7);
  assert.equal(major.byCategory.length, 2);

  const latest = (await (await get('semesters')).json()).data.items;
  assert.deepEqual(latest.map(item => item.semester.semesterId), [semester(2024, '20'), semester(2024, '10')]);
  const response = await get(spring + '?limit=1');
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const first = await response.json();
  assert.equal(first.data.items[0].courseCode, 'A-MAJOR');
  assert.equal(first.data.items[0].courseId, null);
  assert.equal(first.data.summary.earnedCredits, 4);
  assert.equal(first.data.summary.gpa, 2.7);
  const cursor = first.meta.nextCursor;
  const next = (await (await get(spring + '?limit=1&cursor=' + cursor)).json()).data;
  assert.equal(next.items[0].status, 'FAILED');
  assert.equal(next.summary.earnedCredits, first.data.summary.earnedCredits);
  assert.equal((await get(spring + '?cursor=' + cursor, otherToken)).status, 409);
  assert.equal((await get(spring + '?category=MAJOR&cursor=' + cursor)).status, 409);
  const invalid = (await (await get(spring)).json()).data.items.find(item => item.courseCode === 'E-INVALID');
  assert.equal(invalid.gradeValid, false);
  const other = (await (await get(spring, otherToken)).json()).data;
  assert.deepEqual(other.items.map(item => item.courseCode), ['PRIVATE']);
  assert.equal(other.summary.earnedCredits, 3);
  assert.equal(other.summary.gpa, 1);

  await academics.save(userId, [transcript(transcriptRows.map(row =>
    row.courseNumber === general.courseNumber ? { ...row, gradeValid: null } : row))]);
  const incomplete = (await (await get('summary')).json()).data;
  assert.equal(incomplete.earnedCredits, null);
  assert.equal(incomplete.gpa, null);
  assert.equal(incomplete.gpaBasis, null);
  assert.equal(incomplete.enrolledCredits, 2);
  assert.ok(incomplete.warnings.some(warning => warning.code === 'GRADE_VALIDITY_UNKNOWN'));
  assert.equal((await get(spring + '?cursor=' + cursor)).status, 409);
  await academics.save(userId, [transcript(transcriptRows)]);
  const restored = (await (await get('summary')).json()).data;
  assert.equal(restored.earnedCredits, 5);
  assert.equal(restored.gpa, 2.75);

  await academics.save(userId, [transcript([
    ...transcriptRows,
    row('SEASON-S', '교양선택', 1, 'A0', 4, true, 'SUMMER'),
    row('SEASON-W', '교양선택', 1, 'A0', 4, true, 'WINTER'),
  ])]);
  const withSeasons = (await (await get('semesters')).json()).data.items;
  assert.deepEqual(withSeasons.map(item => item.semester.name), [
    '2024학년도 겨울계절수업', '2024학년도 2학기',
    '2024학년도 여름계절수업', '2024학년도 1학기',
  ]);
});
