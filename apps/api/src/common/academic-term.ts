export interface AcademicTerm {
  year: number;
  termCode: '10' | '20';
}

export interface TranscriptTerm {
  year: number;
  termCode: AcademicTerm['termCode'] | 'SUMMER' | 'WINTER';
}

export function currentSubmissionTerm(now = new Date()): AcademicTerm {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: 'numeric',
  }).formatToParts(now);
  const year = Number(parts.find(part => part.type === 'year')!.value);
  const month = Number(parts.find(part => part.type === 'month')!.value);
  return {
    year: month === 1 ? year - 1 : year,
    termCode: month >= 2 && month < 8 ? '10' : '20',
  };
}

export function validateTerm(year: number, termCode: string): AcademicTerm {
  if (!Number.isInteger(year) || year < 1900 || year > 9999 || (termCode !== '10' && termCode !== '20')) {
    throw new Error('학년도 또는 학기 코드가 올바르지 않습니다.');
  }
  return { year, termCode };
}
