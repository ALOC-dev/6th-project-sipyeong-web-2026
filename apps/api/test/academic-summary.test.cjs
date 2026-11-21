const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const { PGlite } = require('@electric-sql/pglite');
const { AcademicsStore } = require('../dist/academics/academics.store');

test('imports preserve validity and summaries across upload and reupload', async (t) => {
  const database = new PGlite();
  t.after(() => database.close());
  for (const migration of ['001_auth', '002_academic_records']) {
    await database.exec(await readFile(`prisma/migrations/${migration}/migration.sql`, 'utf8'));
  }
  const store = new AcademicsStore();
  await store.onModuleDestroy();
  store.database = { connect: async () => ({ query: database.query.bind(database), release() {} }) };
  const user = (await database.query("INSERT INTO app_users(kakao_id) VALUES ('summary-test') RETURNING id")).rows[0].id;
  await database.exec("INSERT INTO semesters(year,term_code) VALUES (2026,'20')");
  const row = {
    year: 2026, termCode: '20', courseNumber: '01964', courseName: '과목',
    sectionNumber: null, category: '교양필수', credits: 3, grade: 'A', gradePoint: 4,
    status: 'completed', gradeValid: false, retake: true, retakeReference: null,
    source: { documentType: 'transcript', row: 2 },
  };
  const doc = (type, record) => ({ type, name: 'test', hash: 'a'.repeat(64), records: [record] });
  const first = await store.save(user, [doc('transcript', row)]);
  assert.equal(first.imports[0].validationSummary.courses[0].effectiveGradeValid, false);
  assert.equal((await database.query('SELECT grade_valid FROM student_course_records')).rows[0].grade_valid, false);

  await store.save(user, [doc('transcript', { ...row, gradeValid: null })]);
  assert.equal((await database.query('SELECT grade_valid FROM student_course_records')).rows[0].grade_valid, null);
  const pdf = { ...row, courseNumber: '71019', status: 'enrolled', grade: null, gradePoint: null,
    gradeValid: null, source: { documentType: 'enrollment_confirmation', page: 1, row: 3 } };
  const result = await store.save(user, [doc('enrollment_confirmation', pdf)]);
  const summary = result.imports[0].validationSummary;
  assert.deepEqual(summary.display, { gradePoint: false, gradeValid: false });
  assert.equal(summary.courses[0].gradePoint, null);
  assert.equal(summary.courses[0].gradeValid, null);
  assert.equal(summary.courses[0].effectiveGradeValid, true);
  assert.equal(summary.courses[0].retake, true);
  const stored = (await database.query('SELECT validation_summary FROM academic_imports ORDER BY import_id DESC LIMIT 1')).rows[0].validation_summary;
  assert.deepEqual(stored, summary);
  const changed = await store.save(user, [doc('transcript', { ...row, gradeValid: true })]);
  assert.equal(changed.imports[0].validationSummary.courses[0].effectiveGradeValid, true);
});
