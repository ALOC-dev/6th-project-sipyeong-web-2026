import {
  BadRequestException, Body, Controller, Get, Header, Patch, Query, Req, UnprocessableEntityException, UseGuards,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CsrfGuard } from '../auth/csrf.guard';
import { SessionGuard } from '../auth/session.guard';
import type { SessionRequest } from '../auth/session.guard';
import { parseProfilePatch } from './profile.dto';
import { ProfileStore } from './profile.store';

const unverifiedCurriculum = {
  code: 'CURRICULUM_POLICY_UNKNOWN', message: '입력한 교육과정 연도의 적용 여부를 확인할 수 없습니다.',
};
const invalidCurriculum = {
  code: 'CURRICULUM_SELECTION_REQUIRED', message: '저장된 교육과정 연도가 적용 기준과 다릅니다. 적용 교육과정 연도를 다시 선택해 주세요.',
};

function envelope<T>(data: T, warning?: typeof unverifiedCurriculum) {
  return { data, meta: { requestId: randomUUID(), ...(warning && { warnings: [warning] }) } };
}

@Controller()
@UseGuards(SessionGuard)
export class ProfileController {
  constructor(private readonly profiles: ProfileStore) {}

  @Get('users/me')
  @Header('Cache-Control', 'private, no-store')
  async me(@Req() request: SessionRequest) {
    const { userId } = request.academicSession!;
    const { profile, studentDataVersion, curriculumPolicy } = await this.profiles.find(userId);
    const profileCompleted = curriculumPolicy === 'known' || curriculumPolicy === 'unknown';
    return envelope(
      { userId, displayName: '학생', profile, profileCompleted, studentDataVersion },
      curriculumPolicy === 'invalid' ? invalidCurriculum : curriculumPolicy === 'unknown' ? unverifiedCurriculum : undefined,
    );
  }

  @Patch('users/me/profile')
  @UseGuards(CsrfGuard)
  @Header('Cache-Control', 'private, no-store')
  async save(@Req() request: SessionRequest, @Body() body: unknown) {
    const patch = parseProfilePatch(body);
    if (!patch) {
      throw new UnprocessableEntityException({ code: 'VALIDATION_ERROR', message: '학적 정보를 확인해 주세요.' });
    }
    const { profile, studentDataVersion, curriculumPolicy } = await this.profiles.save(request.academicSession!.userId, patch);
    return envelope({ profile, studentDataVersion }, curriculumPolicy === 'unknown' ? unverifiedCurriculum : undefined);
  }

  @Get('departments')
  @Header('Cache-Control', 'private, no-store')
  async departments(@Query('q') search: unknown, @Query('limit') requestedLimit: unknown) {
    const limit = requestedLimit === undefined ? 20 : Number(requestedLimit);
    if ((search !== undefined && (typeof search !== 'string' || search.length > 100 || search.includes('\0'))) ||
        (requestedLimit !== undefined && (typeof requestedLimit !== 'string' || !/^\d+$/.test(requestedLimit))) ||
        !Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new BadRequestException({ code: 'INVALID_QUERY', message: '학과 검색 조건을 확인해 주세요.' });
    }
    const departments = await this.profiles.departments(search?.trim() ?? '', limit);
    return envelope({
      items: departments.map(({ departmentId, name }) => ({ departmentId, name })),
      curriculumRules: departments.flatMap(({ departmentId, curriculumRules }) =>
        curriculumRules.map(rule => ({ departmentId, ...rule }))),
    });
  }
}
