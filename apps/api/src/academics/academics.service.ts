import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { AcademicsStore } from './academics.store';
import { parseTranscript } from './parsers/transcript.parser';
import { parseEnrollmentConfirmation } from './parsers/enrollment-confirmation.parser';
import type { AcademicTerm, ParsedCourseRecord } from './parsers/parsed-course-record';

export interface AcademicUpload {
  originalname: string;
  buffer: Buffer;
}

@Injectable()
export class AcademicsService {
  constructor(private readonly store: AcademicsStore) {}

  async submit(userId: string, grades: AcademicUpload, timetable: AcademicUpload, term: AcademicTerm) {
    const [transcript, enrollment] = await Promise.all([
      this.parse(() => parseTranscript(grades.buffer)),
      this.parse(() => parseEnrollmentConfirmation(timetable.buffer, term)),
    ]);
    return this.store.save(userId, [
      this.document(timetable, 'enrollment_confirmation', enrollment),
      this.document(grades, 'transcript', transcript),
    ]);
  }

  private async parse(parser: () => Promise<ParsedCourseRecord[]>) {
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
      throw new BadRequestException(error instanceof Error ? error.message : '파일을 파싱하지 못했습니다.');
    }
  }

  private document(file: AcademicUpload, type: ParsedCourseRecord['source']['documentType'], records: ParsedCourseRecord[]) {
    return { type, name: file.originalname, hash: createHash('sha256').update(file.buffer).digest('hex'), records };
  }
}
