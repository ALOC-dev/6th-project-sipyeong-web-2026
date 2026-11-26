import {
  BadRequestException, Body, Controller, Get, Header, Patch, Query, Req, UnprocessableEntityException, UseGuards,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CsrfGuard } from '../auth/csrf.guard';
import { SessionGuard } from '../auth/session.guard';
import type { SessionRequest } from '../auth/session.guard';
import { firstAdmissionYear, lastAdmissionYear, parseProfilePatch } from './profile.dto';
import { ProfileStore } from './profile.store';

function envelope<T>(data: T) {
  return { data, meta: { requestId: randomUUID() } };
}

@Controller()
@UseGuards(SessionGuard)
export class ProfileController {
  constructor(private readonly profiles: ProfileStore) {}

  @Get('users/me')
  @Header('Cache-Control', 'private, no-store')
  async me(@Req() request: SessionRequest) {
    const { userId } = request.academicSession!;
    const { profile, studentDataVersion } = await this.profiles.find(userId);
    return envelope({ userId, displayName: profile?.displayName ?? '학생', profile, profileCompleted: profile !== null, studentDataVersion });
  }

  @Patch('users/me/profile')
  @UseGuards(CsrfGuard)
  @Header('Cache-Control', 'private, no-store')
  async save(@Req() request: SessionRequest, @Body() body: unknown) {
    const patch = parseProfilePatch(body);
    if (!patch) {
      throw new UnprocessableEntityException({ code: 'VALIDATION_ERROR', message: '학적 정보를 확인해 주세요.' });
    }
    const { profile, studentDataVersion } = await this.profiles.save(request.academicSession!.userId, patch);
    return envelope({ profile, studentDataVersion });
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
    const items = await this.profiles.departments(search?.trim() ?? '', limit);
    return envelope({
      items,
      curriculumRules: items.flatMap(({ departmentId }) =>
        Array.from({ length: lastAdmissionYear - firstAdmissionYear + 1 }, (_, index) => {
          const year = firstAdmissionYear + index;
          return { departmentId, admissionYear: year, curriculumYear: year };
        })),
    });
  }
}
