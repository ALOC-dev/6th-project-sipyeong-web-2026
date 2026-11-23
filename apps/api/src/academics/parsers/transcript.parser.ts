import { extractTables, flag, headerLabel, numeric, required, text } from './document-extractor';
import type { TranscriptTerm } from '../../common/academic-term';
import type { ParsedCourseRecord } from './parsed-course-record';

const headers = ['NO.', '학년도', '학기', '교과번호', '교과목명', '교과구분', '학점', '등급', '평점',
  '성적유효여부', '재수강여부', '재수강교과목'];
const summaries = new Set(['전공', '교양', '일반선택', '기타(교직,ROTC)', '총누계']);

const transcriptTermCodes = new Map<string, TranscriptTerm['termCode']>([
  ['1', '10'], ['1학기', '10'], ['10', '10'],
  ['2', '20'], ['2학기', '20'], ['20', '20'],
  ['여름계절수업', 'SUMMER'], ['여름계절학기', 'SUMMER'], ['하계계절수업', 'SUMMER'], ['하계계절학기', 'SUMMER'],
  ['겨울계절수업', 'WINTER'], ['겨울계절학기', 'WINTER'], ['동계계절수업', 'WINTER'], ['동계계절학기', 'WINTER'],
]);

function transcriptTerm(yearCell: Parameters<typeof text>[0], termCell: Parameters<typeof text>[0]): TranscriptTerm {
  const yearText = text(yearCell)?.normalize('NFKC').replace(/\s+/g, '').replace(/학년도?$/, '') ?? '';
  const year = Number(yearText);
  if (!/^\d{4}$/.test(yearText) || year < 1900) {
    throw new Error('학년도는 네 자리 연도여야 합니다.');
  }
  const term = text(termCell)?.normalize('NFKC').replace(/\s+/g, '').replace(/^제(?=[12]학기$)/, '');
  const code = term && transcriptTermCodes.get(term);
  if (!code) {
    throw new Error(term ? '지원하는 학기 표기가 아닙니다. 이 행의 학기 셀을 확인해 주세요.' : '학기 셀이 비어 있습니다.');
  }
  return { year, termCode: code };
}

export async function parseTranscript(file: Buffer): Promise<ParsedCourseRecord[]> {
  const records: ParsedCourseRecord[] = [];
  for (const sheet of await extractTables(file, 'xlsx')) {
    const labels = sheet.rows.map((row) => row.map(headerLabel));
    const header = labels.findIndex((row) => headers.every((label) => row.includes(label)));
    if (header < 0) continue;
    const columns = new Map(labels[header].map((label, index) => [label, index]));

    for (const [offset, row] of sheet.rows.slice(header + 1).entries()) {
      const at = (label: string) => row[columns.get(label)!];
      const rowNumber = header + offset + 2;
      const sequence = text(at('NO.'));
      if (row.every((cell) => text(cell) === null) || (sequence && summaries.has(sequence))) continue;
      try {
        if (!sequence || !/^\d+$/.test(sequence)) throw new Error('상세 행의 순번이 올바르지 않습니다.');
        records.push({
          ...transcriptTerm(at('학년도'), at('학기')),
          courseNumber: required(at('교과번호'), '교과번호'),
          courseName: required(at('교과목명'), '교과목명'),
          sectionNumber: null,
          category: text(at('교과구분')),
          credits: numeric(at('학점'), '학점'),
          grade: required(at('등급'), '등급'),
          gradePoint: text(at('평점')) === null ? null : numeric(at('평점'), '평점'),
          status: 'completed',
          gradeValid: flag(at('성적유효여부'), '성적유효여부'),
          retake: flag(at('재수강여부'), '재수강여부'),
          retakeReference: text(at('재수강교과목')),
          source: { documentType: 'transcript', sheet: sheet.name, row: rowNumber },
        });
      } catch (error) {
        throw new Error(`성적표 ${rowNumber}행: ${(error as Error).message}`);
      }
    }
  }
  if (!records.length) throw new Error('성적표에서 지원하는 과목별 성적 목록을 찾지 못했습니다.');
  return records;
}
