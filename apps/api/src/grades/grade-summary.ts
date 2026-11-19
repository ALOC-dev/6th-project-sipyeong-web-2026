export const categories = ['MAJOR_REQUIRED', 'MAJOR_ELECTIVE', 'GENERAL', 'OTHER', 'UNCLASSIFIED'] as const;
export type Category = typeof categories[number];
export type CategoryFilter = Category | 'MAJOR';

export interface SemesterRow {
  semesterId: string;
  year: number;
  termCode: string;
}

export interface GradeRow {
  recordId: string;
  semester: SemesterRow;
  courseId: string | null;
  courseCode: string;
  courseName: string;
  categoryLabel: string | null;
  credits: number;
  grade: string | null;
  gradePoint: number | null;
  gradeValid: boolean | null;
  status: 'completed' | 'enrolled' | 'withdrawn';
  documentType: 'transcript' | 'enrollment_confirmation';
}

const labels = new Map<string, Category>([
  ['전공필수', 'MAJOR_REQUIRED'], ['전필', 'MAJOR_REQUIRED'],
  ['전공선택', 'MAJOR_ELECTIVE'], ['전선', 'MAJOR_ELECTIVE'],
  ['교양', 'GENERAL'], ['교양필수', 'GENERAL'], ['교필', 'GENERAL'],
  ['교양선택', 'GENERAL'], ['교선', 'GENERAL'], ['기초교양', 'GENERAL'],
  ['일반선택', 'OTHER'], ['일선', 'OTHER'], ['자유선택', 'OTHER'],
  ['교직', 'OTHER'], ['ROTC', 'OTHER'], ['기타', 'OTHER'], ['기타(교직,ROTC)', 'OTHER'],
]);

function categoryFor(label: string | null): Category {
  const normalized = label?.normalize('NFKC').replace(/\s+/g, '').toUpperCase() ?? '';
  return labels.get(normalized) ?? 'UNCLASSIFIED';
}

export function selectedCategories(filter: CategoryFilter | null): readonly Category[] {
  if (filter === 'MAJOR') return ['MAJOR_REQUIRED', 'MAJOR_ELECTIVE'];
  return filter === null ? categories : [filter];
}

// UOS academic rules, article 46, and the official grades table.
const gradePoints = new Map([
  ['A+', 45], ['A0', 40], ['B+', 35], ['B0', 30], ['C+', 25], ['C0', 20],
  ['D+', 15], ['D0', 10], ['F0', 0], ['F', 0],
]);

export const policyVersion = 'uos-basic-grades-v1';
export const gradeScale = 4.5;

export function normalizeGrade(grade: string | null) {
  return grade?.normalize('NFKC').trim().toUpperCase() ?? null;
}

export function presentRecord(row: GradeRow) {
  const grade = normalizeGrade(row.grade);
  let status: 'ENROLLED' | 'WITHDRAWN' | 'FAILED' | 'COMPLETED' = 'COMPLETED';
  if (row.status === 'enrolled') status = 'ENROLLED';
  if (row.status === 'withdrawn' || (row.status === 'completed' && grade === 'W')) status = 'WITHDRAWN';
  if (row.status === 'completed' && (grade === 'F0' || grade === 'F' || grade === 'U')) status = 'FAILED';
  return {
    recordId: row.recordId, courseId: row.courseId, courseCode: row.courseCode,
    courseName: row.courseName, semesterId: row.semester.semesterId, credits: row.credits,
    category: categoryFor(row.categoryLabel), grade: status === 'WITHDRAWN' ? null : row.grade,
    gradePoint: row.gradePoint, gradeValid: row.gradeValid, status,
    source: row.documentType === 'transcript' ? 'TRANSCRIPT' : 'TIMETABLE',
  };
}

function totals(rows: GradeRow[]) {
  let earned = 0;
  let enrolled = 0;
  let gpaCredits = 0;
  let weightedPoints = 0;
  let earnedUnknown = false;
  let gpaUnknown = false;
  const missingValidity: string[] = [];
  const gradeUnknown: string[] = [];

  for (const row of rows) {
    const credits = Math.round(row.credits * 10);
    if (row.status === 'enrolled') {
      enrolled += credits;
      continue;
    }
    if (row.status === 'withdrawn' || row.gradeValid === false || credits === 0) continue;
    const grade = normalizeGrade(row.grade);
    const points = grade === null ? undefined : gradePoints.get(grade);
    if (grade === 'U' || grade === 'W') continue;
    if (row.gradeValid === null) {
      missingValidity.push(row.recordId);
      earnedUnknown ||= grade === 'S' || points === undefined || points > 0;
      gpaUnknown ||= grade !== 'S';
      continue;
    }
    if (grade === 'S') {
      earned += credits;
    } else if (points !== undefined) {
      if (points > 0) earned += credits;
      gpaCredits += credits;
      weightedPoints += points * credits;
    } else {
      gradeUnknown.push(row.recordId);
      earnedUnknown = true;
      gpaUnknown = true;
    }
  }

  return {
    earnedCredits: earnedUnknown ? null : earned / 10,
    enrolledCredits: enrolled / 10,
    gpa: gpaUnknown || gpaCredits === 0 ? null : Math.round(weightedPoints * 10 / gpaCredits) / 100,
    missingValidity, gradeUnknown,
  };
}

export function summarizeGrades(rows: GradeRow[], filter: CategoryFilter | null) {
  const byCategory = selectedCategories(filter).map(category => {
    const { earnedCredits, enrolledCredits } = totals(rows.filter(row => categoryFor(row.categoryLabel) === category));
    return { category, earnedCredits, enrolledCredits, requiredCredits: null, remainingCredits: null };
  });
  const { missingValidity, gradeUnknown, ...summary } = totals(rows);
  const warnings = [];
  if (missingValidity.length) warnings.push({
    code: 'GRADE_VALIDITY_UNKNOWN', message: '성적 유효 여부를 확인할 수 없습니다. 성적표를 다시 올려 주세요.',
    relatedIds: missingValidity,
  });
  if (gradeUnknown.length) warnings.push({
    code: 'GRADE_POLICY_UNKNOWN', message: '집계 규칙이 확인되지 않은 성적이 있습니다.', relatedIds: gradeUnknown,
  });

  return { ...summary, gradeScale, byCategory, warnings };
}

export function filterGrades(rows: GradeRow[], filter: CategoryFilter | null) {
  const selected = selectedCategories(filter);
  return rows.filter(row => selected.includes(categoryFor(row.categoryLabel)));
}
