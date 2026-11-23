const { test } = require('node:test');
const assert = require('node:assert/strict');
const { calculateOverview } = require('../dist/overview/overview.calculator');
const { OverviewStore } = require('../dist/overview/overview.store');
const { PGlite } = require('@electric-sql/pglite');
const { readFile } = require('node:fs/promises');

test('overview distinguishes passing credits, GPA, projected retakes and certification', () => {
  const row = { record_id: '1', course_id: 1, course_number_snapshot: '001', course_name_snapshot: 'Test',
    credits: '3', grade: 'A0', grade_point: '4', grade_valid: true, status: 'completed',
    year: 2025, term_code: '20', category_code: 'major_required' };
  const rule = { requirement_id: 1, rule_code: 'total', rule_type: 'total_credits', title: '총 학점',
    category_code: null, min_credits: '6', min_count: null, min_volunteer_hours: null,
    volunteer_course_alternative: false, courses: [], options: [] };
  const input = { profile: { volunteer_hours: null }, sets: [{ requirement_set_id: 1 }],
    languages: [{ exam_type: 'TOEIC', score: '800', grade: null }],
    records: [row, { ...row, course_id: 2, course_number_snapshot: '002', grade: 'F0', grade_point: '0' },
      { ...row, course_id: 3, grade: 'S', grade_point: '4.5', credits: '1' },
      { ...row, course_id: 4, grade_valid: false },
      { ...row, year: 2026, status: 'enrolled', grade: null, grade_point: null }],
    requirements: [rule,
      { ...rule, rule_code: 'service', rule_type: 'volunteer', min_credits: null,
        min_volunteer_hours: '20', volunteer_course_alternative: true, courses: [{ course_id: 3 }] },
      { ...rule, rule_code: 'language', rule_type: 'language_certification', min_credits: null,
        options: [{ exam_type: 'TOEIC', min_score: '700', accepted_grade: null }] }] };
  const result = calculateOverview(input, { year: 2026, termCode: '20' });
  assert.equal(result.credits.earned, 4);
  assert.equal(result.credits.projected, 4);
  assert.equal(result.gpa.overall, 2);
  assert.equal(result.graduation.requirements[1].status, 'met');
  assert.equal(result.graduation.requirements[2].status, 'met');
  assert.equal(result.graduation.remainingCredits, 2);
  const unknown = calculateOverview({ ...input, records: [{ ...row, grade_valid: null }] }, { year: 2026, termCode: '20' });
  assert.equal(unknown.credits.earned, null);
  assert.equal(unknown.gpa.overall, null);
  assert.equal(unknown.graduation.requirements[0].status, 'unknown');
  assert.equal(unknown.graduation.progressPercent, null);
  assert.equal(calculateOverview({ ...input, sets: [], requirements: [] }, { year: 2026, termCode: '20' }).graduation.status, 'unknown');
});

test('overview store loads a consistent curriculum snapshot from migrations', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  for (const migration of ['001_auth', '002_academic_records', '003_graduation_requirements', '004_course_prerequisites', '005_profile_registration']) {
    await db.exec(await readFile(`prisma/migrations/${migration}/migration.sql`, 'utf8'));
  }
  const store = new OverviewStore();
  await store.onModuleDestroy();
  store.database = { connect: async () => ({ query: db.query.bind(db), release() {} }) };
  const user = (await db.query("INSERT INTO app_users(kakao_id) VALUES ('overview') RETURNING id")).rows[0].id;
  await db.exec("INSERT INTO student_profiles(user_id,department_id,student_no,admission_year) SELECT id,34,'test',2024 FROM app_users; INSERT INTO graduation_requirement_sets(department_id,admission_year_from,source_ref) VALUES (34,2024,'test'); INSERT INTO graduation_requirements(requirement_set_id,rule_code,rule_type,title,min_credits) VALUES (1,'total','total_credits','총 학점',130)");
  await db.exec(await readFile('prisma/migrations/006_academic_overview/migration.sql', 'utf8'));
  await db.exec("INSERT INTO graduation_requirements(requirement_set_id,rule_code,rule_type,title) VALUES (1,'language','language_certification','어학')");
  await db.exec("INSERT INTO graduation_language_options(requirement_id,exam_type,min_score) SELECT requirement_id,'TOEIC',700 FROM graduation_requirements WHERE rule_code='language'");
  const input = await store.load(user);
  assert.equal(input.requirements.length, 2);
  assert.equal(input.requirements[0].min_credits, '130.0');
  assert.equal(input.requirements[1].options[0].exam_type, 'TOEIC');
  assert.deepEqual(input.requirements[0].courses, []);
  assert.equal(input.profile.admission_year, 2024);
});
