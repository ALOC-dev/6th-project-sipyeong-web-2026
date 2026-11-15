import { Body, Controller, Get, Patch, Query, Req, Res } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { csrfMatches, failure, noCache, readCookie, sessionCookie } from '../auth/controller';
import { AuthStore } from '../auth/store';
import { Profile, ProfilePatch, ProfileStore, supportedDepartmentId } from './profile.store';

const fields = ['departmentId', 'admissionYear', 'curriculumYear', 'studentNumber'] as const;

function isYear(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function isProfilePatch(value: unknown): value is ProfilePatch {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const patch = value as Record<string, unknown>;
  const keys = Object.keys(patch);
  if (keys.length < 2 || !keys.every((key) => key === 'expectedRevision' ||
      fields.some((field) => field === key))) return false;

  const { expectedRevision, admissionYear, curriculumYear, studentNumber } = patch;
  return isYear(expectedRevision) && expectedRevision >= 0 && expectedRevision <= 2_147_483_646 &&
    (patch.departmentId === undefined || patch.departmentId === supportedDepartmentId) &&
    (admissionYear === undefined || (isYear(admissionYear) && admissionYear >= 2020 && admissionYear <= 2026)) &&
    (curriculumYear === undefined || (isYear(curriculumYear) && curriculumYear >= 1900 && curriculumYear <= 9999)) &&
    (studentNumber === undefined || studentNumber === null ||
      (typeof studentNumber === 'string' && studentNumber.trim().length > 0 && !studentNumber.includes('\0') &&
        [...studentNumber].length <= 30));
}

const unverified = { code: 'CURRICULUM_POLICY_UNKNOWN', message: '입력한 교육과정 연도의 적용 여부를 확인할 수 없습니다.' };

function success(response: Response, data: object, warnings = false) {
  return response.json({ data, meta: { requestId: randomUUID(), ...(warnings ? { warnings: [unverified] } : {}) } });
}

@Controller()
export class ProfileController {
  constructor(private readonly auth: AuthStore, private readonly profiles: ProfileStore) {}

  private session(request: Request) {
    const token = readCookie(request, sessionCookie);
    return token && process.env.DATABASE_URL ? this.auth.session(token) : undefined;
  }

  @Get('users/me')
  async me(@Req() request: Request, @Res() response: Response) {
    noCache(response);
    const session = await this.session(request);
    if (!session) return failure(response, 401, 'UNAUTHENTICATED', '로그인이 필요합니다.');
    const { profile, studentDataVersion } = await this.profiles.find(session.userId);
    const policy = profile ? await this.profiles.validateCurriculum(profile) : 'incomplete';
    const profileCompleted = policy !== 'incomplete' && policy !== 'invalid';
    return success(response, { userId: session.userId, displayName: '학생', profile, profileCompleted, studentDataVersion },
      policy === 'unknown' || policy === 'invalid');
  }

  @Patch('users/me/profile')
  async save(@Req() request: Request, @Res() response: Response, @Body() body: unknown) {
    noCache(response);
    const session = await this.session(request);
    if (!session) return failure(response, 401, 'UNAUTHENTICATED', '로그인이 필요합니다.');
    if (!csrfMatches(request, session.csrfToken)) {
      return failure(response, 403, 'CSRF_INVALID', '요청을 검증할 수 없습니다.');
    }
    if (!isProfilePatch(body)) return failure(response, 422, 'VALIDATION_ERROR', '학적 정보를 확인해 주세요.');

    const { profile: current } = await this.profiles.find(session.userId);
    const conflict = () => failure(response, 409, 'REVISION_CONFLICT', '학적 정보가 변경되었습니다. 다시 조회해 주세요.');
    if ((current?.revision ?? 0) !== body.expectedRevision) return conflict();

    const profile: Profile = {
      departmentId: body.departmentId ?? current?.departmentId ?? null,
      admissionYear: body.admissionYear ?? current?.admissionYear ?? null,
      curriculumYear: body.curriculumYear ?? current?.curriculumYear ?? null,
      studentNumber: body.studentNumber === undefined ? current?.studentNumber ?? null : body.studentNumber,
      revision: body.expectedRevision,
    };
    const policy = await this.profiles.validateCurriculum(profile);
    if (policy === 'invalid') return failure(response, 422, 'VALIDATION_ERROR', '적용 교육과정 연도를 확인해 주세요.');
    const saved = await this.profiles.save(session.userId, profile);
    return saved ? success(response, saved, policy === 'unknown') : conflict();
  }

  @Get('departments')
  async departments(@Req() request: Request, @Res() response: Response, @Query('q') search: unknown,
    @Query('limit') requestedLimit: unknown) {
    noCache(response);
    if (!await this.session(request)) return failure(response, 401, 'UNAUTHENTICATED', '로그인이 필요합니다.');
    const limit = requestedLimit === undefined ? 20 : Number(requestedLimit);
    if ((search !== undefined && typeof search !== 'string') ||
        (requestedLimit !== undefined && (typeof requestedLimit !== 'string' || !/^\d+$/.test(requestedLimit))) ||
        !Number.isInteger(limit) || limit < 1 || limit > 100) {
      return failure(response, 400, 'INVALID_QUERY', '학과 검색 조건을 확인해 주세요.');
    }
    return success(response, { items: await this.profiles.departments(typeof search === 'string' ? search.trim() : '', limit) });
  }
}
