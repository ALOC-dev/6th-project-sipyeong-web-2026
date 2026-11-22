import { Body, Controller, Header, Patch, Put, Req, UseGuards } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { SessionGuard } from '../auth/session.guard';
import type { SessionRequest } from '../auth/session.guard';
import { CsrfGuard } from '../auth/csrf.guard';
import { parseLanguageScores, parseVolunteerHours } from './student-info.dto';
import { StudentInfoStore } from './student-info.store';

@Controller('me')
@UseGuards(SessionGuard, CsrfGuard)
export class StudentInfoController {
  constructor(private readonly store: StudentInfoStore) {}

  @Put('language-scores')
  @Header('Cache-Control', 'private, no-store')
  async languageScores(@Req() request: SessionRequest, @Body() body: unknown) {
    const scores = parseLanguageScores(body);
    return { data: await this.store.replaceLanguageScores(request.academicSession!.userId, scores),
      meta: { requestId: randomUUID() } };
  }

  @Patch('volunteer-hours')
  @Header('Cache-Control', 'private, no-store')
  async volunteerHours(@Req() request: SessionRequest, @Body() body: unknown) {
    const hours = parseVolunteerHours(body);
    return { data: await this.store.updateVolunteerHours(request.academicSession!.userId, hours),
      meta: { requestId: randomUUID() } };
  }
}
