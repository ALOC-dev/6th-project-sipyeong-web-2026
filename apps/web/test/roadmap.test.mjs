import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import ts from 'typescript';

// Match the app's extensionless TypeScript imports in the Node test runner.
const load = createRequire(import.meta.url);
const previous = load.extensions['.ts'];
load.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
}).outputText, file);
const { additionProblem, creditsOf, evaluatePlan, recommend, requirementPlans, validateRecommendedPlan } = load('../app/plan-data.ts');
if (previous) load.extensions['.ts'] = previous;
else delete load.extensions['.ts'];

const terms = ['2027-1', '2027-2'];

test('course addition rejects cross-semester custom duplicates and the semester credit cap', () => {
  const data = roadmap([], []);
  const custom = { code: null, name: '직접 입력 과목', credits: 3, category: '교양선택' };
  const plan = [{ term: terms[0], courses: [custom] }, { term: terms[1], courses: [] }];
  assert.match(additionProblem(data, plan, terms[1], { ...custom, name: '직접입력과목' }), /이미/);
  assert.equal(additionProblem(data, plan, terms[1], { ...custom, name: '다른 과목' }), null);
  plan[1].courses = [{ ...custom, name: '큰 과목', credits: 18 }];
  assert.match(additionProblem(data, plan, terms[1], { ...custom, name: '다른 과목' }), /20학점/);
});

test('course addition catches a catalog course duplicating a custom name and completed codes', () => {
  const ref = course(1, 'major_required', 3);
  const data = roadmap([ref], []);
  const candidate = { code: ref.code, name: ref.name, credits: 3, category: '전공필수' };
  const plan = [{ term: terms[0], courses: [{ ...candidate, code: null }] }, { term: terms[1], courses: [] }];
  assert.match(additionProblem(data, plan, terms[1], candidate), /이미/);
  assert.match(additionProblem({ ...data, completed: ['1'] }, [{ term: terms[1], courses: [] }], terms[1], candidate), /이미/);
});
function course(id, categoryCode, credits, termCode = '10', area = null, prerequisites = []) {
  return { id, code: String(id), name: String(id), categoryCode, area, credits, prerequisites,
    offerings: [{ year: 2026, termCode, credits }] };
}
function rule(code, remaining, courses = []) {
  return { code, title: code, unit: 'credits', type: code === 'total' ? 'total_credits' : 'course_credits',
    requiredValue: remaining, projectedValue: 0, missingCourses: courses.map(course => ({ course_id: course.id })),
    status: 'unmet', enrolledCourses: [] };
}
function roadmap(catalog, requirements, liberalRoom = 8) {
  return { currentTerm: { year: 2026, termCode: '20' }, completed: [], enrolled: [], catalog,
    recognition: { liberalLimit: 48, projectedLiberal: 48 - liberalRoom }, graduation: { requirements } };
}

test('recommendation meets named course requirements and spends its remaining budget on varied liberal areas', () => {
  const major = course(1, 'major_required', 3);
  const extraMajor = course(2, 'major_elective', 3, '20');
  const professional = course(3, 'liberal_elective', 2, '10', '공학소양');
  const humanities = course(4, 'liberal_elective', 2, '20', '인문·사회');
  const anotherHumanities = course(5, 'liberal_elective', 2, '20', '인문·사회');
  const science = course(6, 'liberal_elective', 2, '20', '자연·공학');
  const data = roadmap([major, extraMajor, professional, humanities, anotherHumanities, science],
    [rule('total', 9), rule('major72', 3, [major]), rule('professional16', 2, [professional])]);
  const plan = recommend(data, terms, [4, 5]);
  const { accepted, issues } = evaluatePlan(data, plan);
  assert.deepEqual(issues, []);
  assert.deepEqual(new Set(accepted.map(item => item.code)), new Set(['1', '3', '4', '6']));
  assert.ok(requirementPlans(data, accepted).every(item => item.remaining === 0));
});

test('a required liberal course is recommended above the liberal cap and adds no excess graduation credits', () => {
  const intro = course(1, 'major_required', 2);
  const advanced = course(2, 'major_elective', 3, '20', null, [
    { relation: 'required', rule: 'all', courses: [{ code: '1', name: '선수과목' }] },
  ]);
  const professional = course(3, 'liberal_elective', 2, '20', '공학소양');
  const elective = course(4, 'general_elective', 2, '10');
  const data = roadmap([advanced, intro, professional, elective],
    [rule('total', 7), rule('engineering60', 3, [advanced]), rule('professional16', 2, [professional])], 0);
  const plan = recommend(data, terms, [3, 4]);
  const { accepted, issues } = evaluatePlan(data, plan);
  assert.equal(creditsOf(accepted), 9);
  assert.deepEqual(issues, []);
  assert.ok(plan[0].courses.some(item => item.code === '1'));
  assert.ok(plan[1].courses.some(item => item.code === '2'));
  assert.ok(requirementPlans(data, accepted).every(item => item.remaining === 0));
});

test('an unavailable prerequisite leaves a visible outstanding requirement', () => {
  const advanced = course(2, 'major_elective', 3, '20', null, [
    { relation: 'required', rule: 'all', courses: [{ code: '1', name: '선수과목' }] },
  ]);
  const data = roadmap([advanced], [rule('engineering60', 3, [advanced])]);
  const { accepted } = evaluatePlan(data, recommend(data, terms, [3, 3]));
  assert.equal(accepted.length, 0);
  assert.equal(requirementPlans(data, accepted)[0].remaining, 3);
});

test('recommendation keeps a manually selected course and schedules its zero-credit prerequisite', () => {
  const intro = course(1, 'major_required', 0);
  const advanced = course(2, 'major_elective', 3, '20', null, [
    { relation: 'required', rule: 'all', courses: [{ code: '1', name: '선수과목' }] },
  ]);
  const data = roadmap([advanced, intro], [rule('engineering60', 3, [advanced])]);
  const existing = { semesters: [{ term: terms[1], courses: [{ code: '2', name: '2', credits: 3, manual: true }] }] };
  const plan = recommend(data, terms, [0, 3], existing);
  assert.deepEqual(plan.map(semester => semester.courses.map(item => item.code)), [['1'], ['2']]);
  assert.deepEqual(evaluatePlan(data, plan).issues, []);
});

test('updated offering credits invalidate a saved semester that exceeds its credit limit', () => {
  const first = course(1, 'major_required', 12);
  const second = course(2, 'major_required', 9);
  const data = roadmap([first, second], [rule('major72', 20, [first, second])]);
  const saved = [{ term: terms[0], target: 20, courses: [
    { code: '1', name: '1', credits: 11, manual: true }, { code: '2', name: '2', credits: 9, manual: true },
  ] }];
  const evaluation = evaluatePlan(data, saved);
  assert.match(evaluation.issues[0], /21학점/);
  assert.equal(evaluation.accepted.length, 0);
  assert.equal(requirementPlans(data, evaluation.accepted)[0].remaining, 20);
});

test('recommendation approval requires total credits and every numeric requirement with valid offerings', () => {
  const major = course(1, 'major_required', 3);
  const science = course(2, 'liberal_elective', 4, '20', '학문기초');
  const data = roadmap([major, science], [rule('total', 7), rule('major', 3, [major]), rule('science', 4, [science])]);
  const plan = recommend(data, terms, [3, 4]);
  assert.equal(validateRecommendedPlan(data, plan).ready, true);
  const missingScience = plan.map(semester => ({ ...semester, courses: semester.courses.filter(c => c.code !== '2') }));
  const missing = validateRecommendedPlan(data, missingScience);
  assert.equal(missing.ready, false);
  assert.ok(missing.outstanding.some(rule => rule.code === 'science'));
  assert.equal(validateRecommendedPlan({ ...data, catalog: [major] }, plan).ready, false);
  assert.equal(validateRecommendedPlan({ ...data, graduation: { requirements: [] } }, []).ready, false);
  const unknown = { ...data, graduation: { requirements: [...data.graduation.requirements,
    { ...rule('unknown', 3, [science]), status: 'unknown', projectedValue: null }] } };
  assert.equal(validateRecommendedPlan(unknown, plan).ready, false);
  assert.equal(validateRecommendedPlan(unknown, plan).unresolved[0].code, 'unknown');
});
