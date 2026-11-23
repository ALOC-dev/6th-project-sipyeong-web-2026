export const supportedDepartmentId = '34';

export interface LanguageScore {
  examType: string;
  score: number | null;
  grade: string | null;
  takenAt: string | null;
}

export interface ExpectedGraduation {
  graduationYear: number;
  graduationMonth: 2 | 8;
}

export interface ProfilePatch {
  departmentId?: string;
  admissionYear?: number;
  curriculumYear?: number;
  studentNumber?: string | null;
  volunteerHours?: number | null;
  languageScores?: LanguageScore[];
  expectedGraduation?: ExpectedGraduation | null;
  studySemester?: number;
  expectedRevision: number;
}

const fields = new Set([
  'departmentId', 'admissionYear', 'curriculumYear', 'studentNumber',
  'volunteerHours', 'languageScores', 'expectedGraduation', 'studySemester', 'expectedRevision',
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function integer(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

function textField(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 &&
    !value.includes('\0') && [...value.trim()].length <= max;
}

function languageScore(value: unknown): LanguageScore | undefined {
  if (!isObject(value) || Object.keys(value).some(key => !['examType', 'score', 'grade', 'takenAt'].includes(key))) {
    return undefined;
  }
  const { examType, score = null, grade = null, takenAt = null } = value;
  if (!textField(examType, 100) ||
      (score !== null && (typeof score !== 'number' || !Number.isFinite(score) || score < 0)) ||
      (grade !== null && !textField(grade, 100)) ||
      (score === null && grade === null)) return undefined;
  if (takenAt !== null) {
    if (typeof takenAt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(takenAt) || takenAt.startsWith('0000-')) return undefined;
    const date = new Date(takenAt);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== takenAt) return undefined;
  }
  return { examType: examType.trim(), score, grade: grade?.trim() ?? null, takenAt };
}

export function parseProfilePatch(value: unknown): ProfilePatch | undefined {
  if (!isObject(value) || Object.keys(value).length < 2 || Object.keys(value).some(key => !fields.has(key))) {
    return undefined;
  }
  const { departmentId, admissionYear, curriculumYear, studentNumber, volunteerHours, expectedRevision } = value;
  if (!integer(expectedRevision, 0, 2_147_483_646) ||
      (departmentId !== undefined && departmentId !== supportedDepartmentId) ||
      (admissionYear !== undefined && !integer(admissionYear, 2020, 2026)) ||
      (curriculumYear !== undefined && !integer(curriculumYear, 1900, 9999)) ||
      (studentNumber != null && !textField(studentNumber, 30)) ||
      (volunteerHours != null && (typeof volunteerHours !== 'number' || !Number.isFinite(volunteerHours) ||
       volunteerHours < 0 || volunteerHours > 99999.9 || Math.round(volunteerHours * 10) / 10 !== volunteerHours))) {
    return undefined;
  }
  const { languageScores, expectedGraduation, studySemester } = value;
  if (studySemester !== undefined && (!integer(studySemester, 1, 8) || expectedGraduation !== undefined)) return undefined;
  let graduation: ExpectedGraduation | null | undefined;
  if (expectedGraduation === null) graduation = null;
  else if (expectedGraduation !== undefined) {
    if (!isObject(expectedGraduation) || Object.keys(expectedGraduation).length !== 2) return undefined;
    const { graduationYear, graduationMonth } = expectedGraduation;
    if (!integer(graduationYear, 1901, 9999) || (graduationMonth !== 2 && graduationMonth !== 8)) return undefined;
    graduation = { graduationYear, graduationMonth };
  }
  if (languageScores !== undefined && (!Array.isArray(languageScores) || languageScores.length > 50)) return undefined;

  const scores: LanguageScore[] = [];
  for (const input of languageScores ?? []) {
    const entry = languageScore(input);
    if (!entry) return undefined;
    scores.push(entry);
  }

  return {
    expectedRevision, departmentId, admissionYear, curriculumYear, studySemester,
    studentNumber: typeof studentNumber === 'string' ? studentNumber.trim() : studentNumber,
    volunteerHours, expectedGraduation: graduation, languageScores: languageScores === undefined ? undefined : scores,
  };
}
