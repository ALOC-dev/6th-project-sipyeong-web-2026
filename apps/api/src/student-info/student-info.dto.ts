import { BadRequestException } from '@nestjs/common';

export interface LanguageScoreInput {
  examType: string;
  score: number | null;
  grade: string | null;
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException('JSON 객체를 입력해 주세요.');
  }
  return value as Record<string, unknown>;
}

export function parseLanguageScores(body: unknown): LanguageScoreInput[] {
  const { scores } = object(body);
  if (!Array.isArray(scores) || scores.length > 50) {
    throw new BadRequestException('scores는 최대 50개 항목의 배열이어야 합니다.');
  }
  const exams = new Set<string>();
  return scores.map(value => {
    const item = object(value);
    const examType = typeof item.examType === 'string' ? item.examType.trim() : '';
    if (!examType || examType.length > 100 || exams.has(examType)) {
      throw new BadRequestException('시험 종류를 중복 없이 입력해 주세요. 최대 100자입니다.');
    }
    exams.add(examType);
    const score = item.score ?? null;
    const grade = item.grade == null ? null : typeof item.grade === 'string' ? item.grade.trim() : '';
    if ((score === null) === (grade === null) ||
        (score !== null && (typeof score !== 'number' || !Number.isFinite(score) || score < 0)) ||
        (grade !== null && (!grade || grade.length > 100))) {
      throw new BadRequestException('시험별 숫자 성적 또는 등급 중 하나를 입력해 주세요.');
    }
    return { examType, score: score as number | null, grade };
  });
}

export function parseVolunteerHours(body: unknown): number | null {
  const { volunteerHours } = object(body);
  if (volunteerHours === null) return null;
  if (typeof volunteerHours !== 'number' || !Number.isFinite(volunteerHours) ||
      volunteerHours < 0 || volunteerHours > 99999.9 ||
      Number(volunteerHours.toFixed(1)) !== volunteerHours) {
    throw new BadRequestException('봉사 시간은 0~99999.9의 숫자(소수 첫째 자리) 또는 null이어야 합니다.');
  }
  return volunteerHours;
}
