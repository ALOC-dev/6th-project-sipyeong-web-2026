import { BadRequestException, Body, Controller, Header, Post, Req, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import { CsrfGuard } from '../auth/csrf.guard';
import { SessionGuard } from '../auth/session.guard';
import type { SessionRequest } from '../auth/session.guard';
import { AcademicsService } from './academics.service';
import { parseSubmissionTerm } from './dto/submit-academics.dto';
import type { AcademicUpload } from './academics.service';

@Controller('academics')
@UseGuards(SessionGuard, CsrfGuard)
export class AcademicsController {
  constructor(private readonly service: AcademicsService) {}

  @Post('imports')
  @Header('Cache-Control', 'private, no-store')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'grades', maxCount: 1 },
    { name: 'timetable', maxCount: 1 },
  ], { limits: { fileSize: 10 * 1024 * 1024, files: 2, fields: 2, fieldSize: 32 } }))
  async submit(
    @Req() request: SessionRequest,
    @UploadedFiles() files: { grades?: AcademicUpload[]; timetable?: AcademicUpload[] } | undefined,
    @Body() body: Record<string, unknown> | undefined,
  ) {
    const grades = files?.grades?.[0];
    const timetable = files?.timetable?.[0];
    if (!grades || !timetable ||
        !grades.originalname.toLowerCase().endsWith('.xlsx') ||
        !timetable.originalname.toLowerCase().endsWith('.pdf') ||
        !grades.buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 3, 4])) ||
        timetable.buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
      throw new BadRequestException('성적표 XLSX와 수강신청확인서 PDF를 각각 하나씩 제출해 주세요.');
    }
    const term = parseSubmissionTerm(body?.year, body?.termCode);
    const data = await this.service.submit(request.academicSession!.userId, grades, timetable, term);
    return { data, meta: { requestId: randomUUID() } };
  }
}
