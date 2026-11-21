import { Controller, Get, Header, Req, UseGuards } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { SessionGuard } from '../auth/session.guard';
import type { SessionRequest } from '../auth/session.guard';
import { OverviewService } from './overview.service';

@Controller('me')
@UseGuards(SessionGuard)
export class OverviewController {
  constructor(private readonly service: OverviewService) {}
  @Get('summary')
  @Header('Cache-Control', 'private, no-store')
  async summary(@Req() request: SessionRequest) {
    return { data: await this.service.summary(request.academicSession!.userId), meta: { requestId: randomUUID() } };
  }
  @Get('graduation')
  @Header('Cache-Control', 'private, no-store')
  async graduation(@Req() request: SessionRequest) {
    return { data: await this.service.graduation(request.academicSession!.userId), meta: { requestId: randomUUID() } };
  }
}
