export interface AcademicTerm {
  year: number;
  termCode: '10' | '20';
}

export interface TranscriptTerm {
  year: number;
  termCode: AcademicTerm['termCode'] | 'SUMMER' | 'WINTER';
}

function seoulYearMonth(now: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: 'numeric',
  }).formatToParts(now);
  const year = Number(parts.find(part => part.type === 'year')!.value);
  const month = Number(parts.find(part => part.type === 'month')!.value);
  return { year, month };
}

export function currentSubmissionTerm(now = new Date()): AcademicTerm {
  const { year, month } = seoulYearMonth(now);
  return {
    year: month === 1 ? year - 1 : year,
    termCode: month >= 2 && month < 8 ? '10' : '20',
  };
}

export function currentAcademicTerm(now = new Date()): AcademicTerm {
  const { year, month } = seoulYearMonth(now);
  return { year: month < 3 ? year - 1 : year, termCode: month >= 3 && month < 9 ? '10' : '20' };
}

export function termIndex(term: AcademicTerm) {
  return term.year * 2 + (term.termCode === '20' ? 1 : 0);
}

export function graduationAfterEightSemesters(term: AcademicTerm, studySemester: number) {
  const finalTerm = termIndex(term) + 8 - studySemester;
  const inSpring = finalTerm % 2 === 0;
  return { graduationYear: Math.floor(finalTerm / 2) + (inSpring ? 0 : 1), graduationMonth: inSpring ? 8 as const : 2 as const };
}

export function validateTerm(year: number, termCode: string): AcademicTerm {
  if (!Number.isInteger(year) || year < 1900 || year > 9999 || (termCode !== '10' && termCode !== '20')) {
    throw new Error('학년도 또는 학기 코드가 올바르지 않습니다.');
  }
  return { year, termCode };
}
