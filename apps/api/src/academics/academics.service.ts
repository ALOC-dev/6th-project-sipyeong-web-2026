import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { AcademicsStore } from './academics.store';
import { academicFileName } from './academic-file-name';
import { parseTranscript } from './parsers/transcript.parser';
import { parseEnrollmentDocument } from './parsers/enrollment-confirmation.parser';
import { DocumentExtractorUnavailable } from './parsers/document-extractor';
import type { ParsedCourseRecord } from './parsers/parsed-course-record';
import type { AcademicTerm } from '../common/academic-term';
import { currentSubmissionTerm } from '../common/academic-term';

export interface AcademicUpload {
  originalname: string;
  buffer: Buffer;
}

@Injectable()
export class AcademicsService {
  constructor(private readonly store: AcademicsStore) {}

  latestImports(userId: string) {
    return this.store.latestImports(userId);
  }

  async submit(userId: string, grades?: AcademicUpload, timetable?: AcademicUpload, term?: AcademicTerm) {
    if (!grades && !timetable) throw new BadRequestException('업로드할 파일이 없습니다.');
    let displayName: string | null = null;
    const [transcript, enrollment] = await Promise.all([
      grades ? this.parse('성적표 XLSX', () => parseTranscript(grades.buffer)) : Promise.resolve([]),
      timetable ? this.parse('수강신청확인서 PDF', async () => {
        const document = await parseEnrollmentDocument(timetable.buffer, term ?? currentSubmissionTerm());
        displayName = document.displayName;
        return document.records;
      }) : Promise.resolve([]),
    ]);
    const documents = [];
    if (timetable) documents.push({ ...this.document(timetable, 'enrollment_confirmation', enrollment), displayName });
    if (grades) documents.push(this.document(grades, 'transcript', transcript));
    return this.store.save(userId, documents);
  }

  private async parse(document: string, parser: () => Promise<ParsedCourseRecord[]>) {
    try {
      const records = await parser();
      const keys = new Set<string>();
      for (const row of records) {
        const key = JSON.stringify([row.year, row.termCode, row.courseNumber]);
        if (keys.has(key)) throw new Error('같은 학기의 동일 교과번호가 파일에 중복됩니다.');
        keys.add(key);
        if (row.credits > 999.9 || Number(row.credits.toFixed(1)) !== row.credits ||
            (row.gradePoint !== null && (row.gradePoint > 9.99 || Number(row.gradePoint.toFixed(2)) !== row.gradePoint))) {
          throw new Error('학점 또는 평점의 범위나 소수 자릿수가 올바르지 않습니다.');
        }
      }
      return records;
    } catch (error) {
      if (error instanceof DocumentExtractorUnavailable) {
        throw new ServiceUnavailableException(error.message, { cause: error });
      }
      const message = error instanceof Error ? error.message : '파일을 파싱하지 못했습니다.';
      throw new BadRequestException({ code: 'ACADEMIC_DOCUMENT_INVALID', message: `${document} · ${message}` });
    }
  }

  private document(file: AcademicUpload, type: ParsedCourseRecord['source']['documentType'], records: ParsedCourseRecord[]) {
    return { type, name: academicFileName(file.originalname), hash: createHash('sha256').update(file.buffer).digest('hex'), records };
  }
}
