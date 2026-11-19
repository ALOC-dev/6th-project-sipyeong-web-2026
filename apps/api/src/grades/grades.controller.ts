import {
  BadRequestException, ConflictException, Controller, Get, Header, NotFoundException, Param, Query, Req, UseGuards,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { SessionGuard } from '../auth/session.guard';
import type { SessionRequest } from '../auth/session.guard';
import { categories, filterGrades, policyVersion, presentRecord, summarizeGrades } from './grade-summary';
import type { CategoryFilter, GradeRow, SemesterRow } from './grade-summary';
import { GradesStore } from './grades.store';

function categoryFilter(value: unknown): CategoryFilter | null {
  if (value === undefined) return null;
  if (value === 'MAJOR') return value;
  const category = categories.find(item => item === value);
  if (!category) throw new BadRequestException({ code: 'INVALID_QUERY', message: '올바른 교과구분을 선택해 주세요.' });
  return category;
}

function basis(studentDataVersion: number) {
  return { studentDataVersion, policyVersion, catalogVersion: 'UNAVAILABLE' };
}

function envelope<T>(data: T, nextCursor?: string | null) {
  return { data, meta: { requestId: randomUUID(), ...(nextCursor !== undefined && { nextCursor }) } };
}

function semesterView(row: SemesterRow) {
  const term = row.termCode === '10' ? 'FIRST' : row.termCode === '20' ? 'SECOND' : null;
  const label = term === 'FIRST' ? '1학기' : term === 'SECOND' ? '2학기' : row.termCode;
  return { ...row, term, name: row.year + '학년도 ' + label, isCurrent: false };
}

function paginate<T>(items: T[], rawLimit: unknown, rawCursor: unknown, scope: string) {
  const limit = rawLimit === undefined ? 20 :
    typeof rawLimit === 'string' && /^\d{1,3}$/.test(rawLimit) ? Number(rawLimit) : NaN;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new BadRequestException({ code: 'INVALID_QUERY', message: '조회 개수는 1~100 사이여야 합니다.' });
  }
  let offset = 0;
  if (rawCursor !== undefined) {
    if (typeof rawCursor !== 'string' || !/^[A-Za-z0-9_-]{1,1024}$/.test(rawCursor)) {
      throw new BadRequestException({ code: 'INVALID_QUERY', message: '페이지 커서가 올바르지 않습니다.' });
    }
    let saved: unknown;
    try {
      saved = JSON.parse(Buffer.from(rawCursor, 'base64url').toString('utf8'));
    } catch {
      throw new BadRequestException({ code: 'INVALID_QUERY', message: '페이지 커서가 올바르지 않습니다.' });
    }
    if (!Array.isArray(saved) || saved.length !== 2 || typeof saved[0] !== 'string' ||
        !Number.isSafeInteger(saved[1]) || saved[1] < 1) {
      throw new BadRequestException({ code: 'INVALID_QUERY', message: '페이지 커서가 올바르지 않습니다.' });
    }
    if (saved[0] !== scope || saved[1] >= items.length) {
      throw new ConflictException({ code: 'CURSOR_STALE', message: '조회 조건이 변경되었습니다. 다시 조회해 주세요.' });
    }
    offset = saved[1];
  }
  const next = offset + limit;
  const nextCursor = next < items.length ? Buffer.from(JSON.stringify([scope, next])).toString('base64url') : null;
  return { items: items.slice(offset, next), nextCursor };
}

@Controller('grades')
@UseGuards(SessionGuard)
export class GradesController {
  constructor(private readonly store: GradesStore) {}

  @Get('summary')
  @Header('Cache-Control', 'private, no-store')
  async summary(@Req() request: SessionRequest, @Query('category') queryCategory: unknown) {
    const filter = categoryFilter(queryCategory);
    const snapshot = await this.store.read(request.academicSession!.userId, null);
    const result = summarizeGrades(filterGrades(snapshot.rows, filter), filter);
    return envelope({
      basis: basis(snapshot.studentDataVersion), filter: { category: filter },
      ...result, requiredCredits: null, remainingCredits: null, creditProgressPercent: null,
      warnings: [...result.warnings, {
        code: 'REQUIREMENT_CREDITS_UNAVAILABLE', message: '졸업 기준학점은 아직 반영되지 않았습니다.', relatedIds: [],
      }],
    });
  }

  @Get('semesters')
  @Header('Cache-Control', 'private, no-store')
  async semesters(
    @Req() request: SessionRequest,
    @Query('category') queryCategory: unknown,
    @Query('limit') limit: unknown,
    @Query('cursor') cursor: unknown,
  ) {
    const filter = categoryFilter(queryCategory);
    const { userId } = request.academicSession!;
    const snapshot = await this.store.read(userId, null);
    const bySemester = new Map<string, GradeRow[]>();
    for (const row of filterGrades(snapshot.rows, filter)) {
      const key = row.semester.semesterId;
      const current = bySemester.get(key);
      if (current) current.push(row);
      else bySemester.set(key, [row]);
    }
    const scope = JSON.stringify([userId, basis(snapshot.studentDataVersion), null, filter]);
    const page = paginate([...bySemester.values()], limit, cursor, scope);
    const items = page.items.map(rows => ({ semester: semesterView(rows[0].semester), ...summarizeGrades(rows, filter) }));
    return envelope({ items, basis: basis(snapshot.studentDataVersion) }, page.nextCursor);
  }

  @Get('semesters/:semesterId')
  @Header('Cache-Control', 'private, no-store')
  async semester(
    @Req() request: SessionRequest,
    @Param('semesterId') semesterId: string,
    @Query('category') queryCategory: unknown,
    @Query('limit') limit: unknown,
    @Query('cursor') cursor: unknown,
  ) {
    if (!/^[1-9]\d{0,9}$/.test(semesterId) || Number(semesterId) > 2147483647) {
      throw new BadRequestException({ code: 'INVALID_QUERY', message: '학기 ID가 올바르지 않습니다.' });
    }
    const filter = categoryFilter(queryCategory);
    const { userId } = request.academicSession!;
    const snapshot = await this.store.read(userId, semesterId);
    if (!snapshot.semester) throw new NotFoundException('존재하지 않는 학기입니다.');
    const rows = filterGrades(snapshot.rows, filter);
    const gradeBasis = basis(snapshot.studentDataVersion);
    const scope = JSON.stringify([userId, gradeBasis, semesterId, filter]);
    const page = paginate(rows, limit, cursor, scope);
    const { warnings, ...summary } = summarizeGrades(rows, filter);
    return envelope({
      semester: semesterView(snapshot.semester), summary, items: page.items.map(presentRecord), basis: gradeBasis, warnings,
    }, page.nextCursor);
  }
}
