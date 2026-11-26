const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const { PGlite } = require('@electric-sql/pglite');
const { AcademicsStore } = require('../dist/academics/academics.store');

test('imports preserve validity and summaries across upload and reupload', async (t) => {
  const database = new PGlite();
  t.after(() => database.close());
  for (const migration of ['001_auth', '002_academic_records', '003_graduation_requirements', '004_course_prerequisites', '005_profile_registration']) {
    await database.exec(await readFile(`prisma/migrations/${migration}/migration.sql`, 'utf8'));
  }
  const store = new AcademicsStore();
  await store.onModuleDestroy();
  const query = database.query.bind(database);
  store.database = { query, connect: async () => ({ query, release() {} }) };
  const user = (await database.query("INSERT INTO app_users(kakao_id) VALUES ('summary-test') RETURNING id")).rows[0].id;
  const secondUser = (await database.query("INSERT INTO app_users(kakao_id) VALUES ('other-summary-test') RETURNING id")).rows[0].id;
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
  const stored = (await database.query('SELECT validation_summary FROM academic_imports WHERE import_id = $1', [result.imports[0].importId])).rows[0].validation_summary;
  assert.deepEqual(stored, summary);
  const legacyName = Buffer.from('과목별 성적 목록.xlsx', 'utf8').toString('latin1');
  const changed = await store.save(user, [{ ...doc('transcript', { ...row, gradeValid: true }), name: legacyName }]);
  assert.equal(changed.imports[0].validationSummary.courses[0].effectiveGradeValid, true);
  await database.query(
    "UPDATE academic_imports SET status = 'failed', committed_at = NULL WHERE import_id = $1",
    [first.imports[0].importId],
  );
  await database.query("UPDATE academic_imports SET committed_at = '2026-11-01T00:00:00Z' WHERE status = 'committed'");
  await store.save(secondUser, [{ ...doc('transcript', row), name: 'another-account.xlsx' }]);
  const latest = await store.latestImports(user);
  assert.equal(latest.grades.name, '과목별 성적 목록.xlsx');
  assert.equal(latest.timetable.name, 'test');
  assert.equal(new Date(latest.grades.appliedAt).toISOString(), '2026-11-01T00:00:00.000Z');
  assert.deepEqual(Object.keys(await store.latestImports(secondUser)), ['grades']);
  assert.equal((await store.latestImports(secondUser)).grades.name, 'another-account.xlsx');
});

test('a full transcript replaces omitted courses and semesters without removing enrollment or another account', async (t) => {
  const database = new PGlite();
  t.after(() => database.close());
  for (const migration of ['001_auth', '002_academic_records', '003_graduation_requirements', '004_course_prerequisites', '005_profile_registration', '012_student_display_name']) {
    await database.exec(await readFile(`prisma/migrations/${migration}/migration.sql`, 'utf8'));
  }
  const store = new AcademicsStore();
  await store.onModuleDestroy();
  const query = database.query.bind(database);
  store.database = { query, connect: async () => ({ query, release() {} }) };
  const user = (await query("INSERT INTO app_users(kakao_id) VALUES ('snapshot') RETURNING id")).rows[0].id;
  const other = (await query("INSERT INTO app_users(kakao_id) VALUES ('snapshot-other') RETURNING id")).rows[0].id;
  for (const id of [user, other]) await query('INSERT INTO student_profiles(user_id,department_id,admission_year) VALUES ($1,34,2023)', [id]);
  await database.exec("INSERT INTO semesters(year,term_code) VALUES (2025,'10'), (2025,'SUMMER'), (2026,'20')");
  const course = (courseNumber, termCode = '10', year = 2025) => ({
    year, termCode, courseNumber, courseName: courseNumber, sectionNumber: null,
    category: '교양선택', credits: 3, grade: 'A0', gradePoint: 4, status: 'completed',
    gradeValid: true, retake: false, retakeReference: null, source: { documentType: 'transcript', row: 2 },
  });
  const document = records => ({ type: 'transcript', name: 'snapshot.xlsx', hash: 'a'.repeat(64), records });
  await store.save(user, [document([course('KEEP'), course('DROP'), course('SUMMER', 'SUMMER')])]);
  await store.save(other, [document([course('DROP')])]);
  const enrolled = { ...course('ENROLLED', '20', 2026), status: 'enrolled', grade: null, gradePoint: null,
    source: { documentType: 'enrollment_confirmation', row: 2 } };
  await store.save(user, [{ ...document([enrolled]), type: 'enrollment_confirmation', displayName: '김민복' }]);
  const name = async id => (await query('SELECT display_name FROM student_profiles WHERE user_id=$1', [id])).rows[0].display_name;
  assert.equal(await name(user), '김민복');
  assert.equal(await name(other), null);
  await store.save(user, [{ ...document([enrolled]), type: 'enrollment_confirmation', displayName: null }]);
  assert.equal(await name(user), '김민복');
  await store.save(user, [document([{ ...course('KEEP'), grade: 'B+', gradePoint: 3.5 }, course('NEW')])]);
  const records = (await query('SELECT course_number_snapshot AS code, grade FROM student_course_records WHERE user_id=$1 ORDER BY code', [user])).rows;
  assert.deepEqual(records, [{ code: 'ENROLLED', grade: null }, { code: 'KEEP', grade: 'B+' }, { code: 'NEW', grade: 'A0' }]);
  assert.equal((await query('SELECT count(*)::int AS n FROM student_course_records WHERE user_id=$1', [other])).rows[0].n, 1);
  await assert.rejects(store.save(user, [document([course('NEW'), course('BAD', '10', 2099)])]));
  assert.deepEqual((await query('SELECT course_number_snapshot AS code, grade FROM student_course_records WHERE user_id=$1 ORDER BY code', [user])).rows, records);
  await assert.rejects(store.save(user, [
    { ...document([enrolled]), type: 'enrollment_confirmation', displayName: '변경실패' },
    document([course('BAD', '10', 2099)]),
  ]));
  assert.equal(await name(user), '김민복');
});
