import { BadRequestException } from '@nestjs/common';
import type { AcademicTerm } from '../parsers/parsed-course-record';

export function parseSubmissionTerm(year: unknown, termCode: unknown): AcademicTerm {
  if (typeof year !== 'string' || !/^\d{4}$/.test(year) || Number(year) < 1900 ||
      (termCode !== '10' && termCode !== '20')) {
    throw new BadRequestException('수강신청 학년도와 학기(10 또는 20)를 입력해 주세요.');
  }
  return { year: Number(year), termCode };
}
