const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const { PGlite } = require('@electric-sql/pglite');
const { StudentInfoStore } = require('../dist/student-info/student-info.store');
const { parseLanguageScores, parseVolunteerHours } = require('../dist/student-info/student-info.dto');

test('student input validates missing, numeric, grade and zero values', () => {
  assert.equal(parseVolunteerHours({ volunteerHours: 0 }), 0);
  assert.equal(parseVolunteerHours({ volunteerHours: null }), null);
  for (const value of [undefined, -1, '20', 1.23, Infinity]) {
    assert.throws(() => parseVolunteerHours({ volunteerHours: value }));
  }
  assert.deepEqual(parseLanguageScores({ scores: [{ examType: ' TOEIC ', score: 800 }] }),
    [{ examType: 'TOEIC', score: 800, grade: null }]);
  assert.equal(parseLanguageScores({ scores: [{ examType: 'OPIc', grade: 'IH' }] })[0].grade, 'IH');
  assert.throws(() => parseLanguageScores({ scores: [{ examType: 'T', score: 0, grade: 'A' }] }));
  assert.throws(() => parseLanguageScores({ scores: [{ examType: 'T' }] }));
  assert.throws(() => parseLanguageScores({ scores: [{ examType: 'T', score: 1 }, { examType: 'T', score: 2 }] }));
});

test('student inputs replace scores and update only authenticated profile', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  for (const migration of ['001_auth', '002_academic_records', '003_graduation_requirements', '004_course_prerequisites', '005_profile_registration']) {
    await db.exec(await readFile(`prisma/migrations/${migration}/migration.sql`, 'utf8'));
  }
  const store = new StudentInfoStore();
  await store.onModuleDestroy();
  store.database = { query: db.query.bind(db), connect: async () => ({ query: db.query.bind(db), release() {} }) };
  const users = (await db.query("INSERT INTO app_users(kakao_id) VALUES ('one'),('two') RETURNING id")).rows;
  const user = users[0].id;
  await assert.rejects(store.updateVolunteerHours(user, 20), error => error.getStatus() === 409);
  await db.query("INSERT INTO student_profiles(user_id,department_id,student_no,admission_year) VALUES ($1,34,'one',2024),($2,34,'two',2024)", [user, users[1].id]);
  await store.updateVolunteerHours(user, 0);
  assert.equal((await db.query('SELECT volunteer_hours FROM student_profiles WHERE user_id=$1', [user])).rows[0].volunteer_hours, '0.0');
  assert.equal((await db.query('SELECT volunteer_hours FROM student_profiles WHERE user_id=$1', [users[1].id])).rows[0].volunteer_hours, null);
  await store.replaceLanguageScores(user, [{ examType: 'TOEIC', score: 700, grade: null }]);
  await store.replaceLanguageScores(user, [{ examType: 'TOEIC', score: 800, grade: null }]);
  const scores = (await db.query('SELECT score FROM student_language_scores')).rows;
  assert.deepEqual(scores, [{ score: '800' }]);
  await store.replaceLanguageScores(user, []);
  assert.equal((await db.query('SELECT * FROM student_language_scores')).rows.length, 0);
  assert.deepEqual((await db.query(
    'SELECT u.student_data_version, p.revision FROM app_users u JOIN student_profiles p ON p.user_id = u.id WHERE u.id = $1', [user],
  )).rows, [{ student_data_version: 4, revision: 5 }]);
});
