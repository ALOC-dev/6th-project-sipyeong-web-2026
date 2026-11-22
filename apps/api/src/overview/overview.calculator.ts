import type { AcademicTerm } from '../common/academic-term';
import { summarizeGradeTotals } from '../grades/grade-summary';
import type { CourseRecord, OverviewInput, Requirement } from './overview.types';

const round = (n: number) => Math.round(n * 100) / 100;
const sum = (rows: CourseRecord[]) => round(rows.reduce((n, r) => n + Number(r.credits), 0));
const gradeTotals = (rows: CourseRecord[]) => summarizeGradeTotals(rows.map(row => ({
  recordId: row.record_id,
  credits: Number(row.credits),
  grade: row.grade,
  gradeValid: row.grade_valid,
  status: row.status,
})));
const gpa = (rows: CourseRecord[]) => gradeTotals(rows).gpa;

function evaluate(rule: Requirement, input: OverviewInput, completed: CourseRecord[], projected: CourseRecord[], enrollment: CourseRecord[], unresolved: CourseRecord[]) {
  let current: number | null = null;
  let future: number | null = null;
  let required: number | null = null;
  let unit: 'credits' | 'courses' | 'hours' | null = null;
  let status: 'met' | 'expected' | 'unmet' | 'unknown' = 'unknown';
  const ids = new Set(rule.courses.map(c => c.course_id));
  const linked = (rows: CourseRecord[]) => rows.filter(r => r.course_id !== null && ids.has(r.course_id));
  if (rule.rule_type === 'language_certification') {
    const met = rule.options.some(option => input.languages.some(score =>
      score.exam_type === option.exam_type &&
      (option.min_score !== null ? score.score !== null && Number(score.score) >= Number(option.min_score)
        : score.grade !== null && score.grade === option.accepted_grade)));
    status = !rule.options.length ? 'unknown' : met ? 'met' : input.languages.length ? 'unmet' : 'unknown';
  } else if (rule.rule_type === 'volunteer') {
    unit = 'hours';
    required = Number(rule.min_volunteer_hours);
    current = input.profile?.volunteer_hours == null ? null : Number(input.profile.volunteer_hours);
    const courseMet = rule.volunteer_course_alternative && linked(completed).length > 0;
    status = courseMet || (current !== null && current >= required) ? 'met'
      : current === null || (rule.volunteer_course_alternative && (!ids.size || linked(unresolved).length > 0))
        ? 'unknown' : 'unmet';
    future = current;
  } else if (['total_credits', 'category_credits', 'course_credits', 'course_count'].includes(rule.rule_type)) {
    const select = (rows: CourseRecord[]) => rule.rule_type === 'category_credits'
      ? rows.filter(r => r.category_code === rule.category_code)
      : rule.rule_type === 'total_credits' ? rows : linked(rows);
    unit = rule.rule_type === 'course_count' ? 'courses' : 'credits';
    const measure = (rows: CourseRecord[]) => unit === 'courses'
      ? new Set(rows.map(r => r.course_id)).size : sum(rows);
    current = measure(select(completed));
    future = measure(select(projected));
    required = Number(rule.rule_type === 'course_count' ? rule.min_count : rule.min_credits);
    const incomplete = rule.rule_type === 'category_credits'
      ? projected.some(r => r.category_code === null)
      : rule.rule_type !== 'total_credits' && (!ids.size || projected.some(r => r.course_id === null));
    const gradesUnknown = select(unresolved).length > 0;
    const coverageUnknown = incomplete || (rule.rule_type === 'category_credits'
      ? unresolved.some(r => r.category_code === null)
      : rule.rule_type !== 'total_credits' && unresolved.some(r => r.course_id === null));
    status = current >= required ? 'met' : future >= required && !gradesUnknown && !coverageUnknown
      ? 'expected' : gradesUnknown || coverageUnknown ? 'unknown' : 'unmet';
    if (gradesUnknown) {
      current = null;
      future = null;
    }
  }
  return {
    code: rule.rule_code, title: rule.title, type: rule.rule_type, status, unit,
    currentValue: current, projectedValue: future, requiredValue: required,
    remaining: current === null || required === null ? null : round(Math.max(0, required - current)),
    missingCourses: rule.courses.filter(c => !completed.some(r => r.course_id === c.course_id)),
    enrolledCourses: rule.courses.filter(c => enrollment.some(r => r.course_id === c.course_id)),
  };
}

export function calculateOverview(input: OverviewInput, term: AcademicTerm) {
  const completed: CourseRecord[] = [];
  const unresolved: CourseRecord[] = [];
  for (const row of input.records) {
    if (row.status !== 'completed') continue;
    const { earnedCredits } = gradeTotals([row]);
    if (earnedCredits === null) unresolved.push(row);
    else if (earnedCredits > 0) completed.push(row);
  }
  const enrollment = input.records.filter(r => r.status === 'enrolled' && r.year === term.year && r.term_code === term.termCode);
  // A current retake must not add credits for a course already counted.
  const key = (r: CourseRecord) => r.course_id === null ? 'number:' + r.course_number_snapshot : 'id:' + r.course_id;
  const completedKeys = new Set(completed.map(key));
  const projected = [...completed, ...enrollment.filter(row => !completedKeys.has(key(row)))];
  const { earnedCredits, gpa: overallGpa } = gradeTotals(input.records);
  const requirements = input.requirements.map(rule => evaluate(rule, input, completed, projected, enrollment, unresolved));
  const total = requirements.find(r => r.type === 'total_credits');
  return {
    profile: input.profile,
    currentTerm: term,
    gpa: { overall: overallGpa, major: gpa(input.records.filter(r => ['major_required', 'major_elective'].includes(r.category_code ?? ''))) },
    credits: {
      earned: earnedCredits, projected: earnedCredits === null ? null : sum(projected), enrolled: sum(enrollment),
      recognized: null, recognitionPolicy: 'category-cap-policy-not-configured',
    },
    currentSemester: { courseCount: enrollment.length, credits: sum(enrollment) },
    semesterGpas: [...new Set(input.records.map(r => r.year + '/' + r.term_code))].map(key => {
      const [year, termCode] = key.split('/');
      return { year: Number(year), termCode, gpa: gpa(input.records.filter(r => r.year === Number(year) && r.term_code === termCode)) };
    }),
    graduation: {
      status: input.sets.length !== 1 || !requirements.length ? 'unknown'
        : requirements.every(r => r.status === 'met') ? 'met'
        : requirements.every(r => ['met', 'expected'].includes(r.status)) ? 'expected'
        : requirements.some(r => r.status === 'unknown') ? 'unknown' : 'unmet',
      requirementSet: input.sets.length === 1 ? input.sets[0] : null,
      progressPercent: total?.requiredValue && total.currentValue !== null ? round(Math.min(100, total.currentValue / total.requiredValue * 100)) : null,
      remainingCredits: total?.remaining ?? null,
      counts: {
        total: requirements.length, met: requirements.filter(r => r.status === 'met').length,
        expected: requirements.filter(r => r.status === 'expected').length,
      },
      requirements,
      warnings: [
        ...(input.sets.length !== 1 ? ['Applicable graduation requirement set is missing or overlaps.'] : []),
        ...(unresolved.length ? ['Some completed grades require a verified transcript.'] : []),
        'Category caps, GPA threshold and graduation date require additional policy data.',
        ...(completed.some(r => r.course_id === null) ? ['Some completed courses are not matched.'] : []),
      ],
    },
    remainingSemesters: null,
    expectedGraduationDate: null,
  };
}
