import { extractTables, flag, headerLabel, numeric, required, text, validateTerm } from './document-extractor';
import type { AcademicTerm, ParsedCourseRecord } from './parsed-course-record';

const headers = ['순번', '교과구분', '교과번호', '분반', '교과목', '학점', '재수강여부', '재수강년도/학기', '수강신청취소여부'];

export async function parseEnrollmentConfirmation(file: Buffer, term: AcademicTerm): Promise<ParsedCourseRecord[]> {
  const semester = validateTerm(term.year, term.termCode);
  const records: ParsedCourseRecord[] = [];
  for (const table of await extractTables(file, 'pdf')) {
    const labels = table.rows.map((row) => row.map(headerLabel));
    const header = labels.findIndex((row) => headers.every((label) => row.includes(label)));
    if (header < 0) continue;
    const columns = new Map(labels[header].map((label, index) => [label, index]));
    const page = Number(table.name);
    for (const [offset, row] of table.rows.slice(header + 1).entries()) {
      const at = (label: string) => row[columns.get(label)!];
      const rowNumber = header + offset + 2;
      if (row.every((cell) => text(cell) === null)) continue;
      try {
        if (!/^\d+$/.test(required(at('순번'), '순번'))) throw new Error('수강 행의 순번이 올바르지 않습니다.');
        const retakeReference = text(at('재수강년도/학기'));
        records.push({
          ...semester,
          courseNumber: required(at('교과번호'), '교과번호'),
          courseName: required(at('교과목'), '교과목').replace(/\s*\n\s*/g, ' '),
          sectionNumber: required(at('분반'), '분반'),
          category: text(at('교과구분')),
          credits: numeric(at('학점'), '학점'),
          grade: null,
          gradePoint: null,
          status: flag(at('수강신청취소여부'), '수강신청취소여부') ? 'withdrawn' : 'enrolled',
          gradeValid: null,
          retake: flag(at('재수강여부'), '재수강여부'),
          retakeReference: retakeReference === '/' ? null : retakeReference,
          source: { documentType: 'enrollment_confirmation', page, row: rowNumber },
        });
      } catch (error) {
        throw new Error(`수강신청확인서 ${page}페이지 표 ${rowNumber}행: ${(error as Error).message}`);
      }
    }
  }
  if (!records.length) throw new Error('PDF에서 지원하는 수강신청 표를 찾지 못했습니다.');
  return records;
}
