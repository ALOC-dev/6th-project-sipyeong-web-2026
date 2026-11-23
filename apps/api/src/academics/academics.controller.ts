import { BadRequestException, Body, Controller, Get, Header, Post, Req, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import { CsrfGuard } from '../auth/csrf.guard';
import { SessionGuard } from '../auth/session.guard';
import type { SessionRequest } from '../auth/session.guard';
import { AcademicsService } from './academics.service';
import { parseSubmissionTerm } from './dto/submit-academics.dto';
import type { AcademicUpload } from './academics.service';

const maxFileSize = 10 * 1024 * 1024;

@Controller('academics')
@UseGuards(SessionGuard)
export class AcademicsController {
  constructor(private readonly service: AcademicsService) {}

  @Get('imports/latest')
  @Header('Cache-Control', 'private, no-store')
  async latest(@Req() request: SessionRequest) {
    return { data: await this.service.latestImports(request.academicSession!.userId), meta: { requestId: randomUUID() } };
  }

  @Post('imports')
  @UseGuards(CsrfGuard)
  @Header('Cache-Control', 'private, no-store')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'grades', maxCount: 1 },
    { name: 'timetable', maxCount: 1 },
  ], { limits: { fileSize: maxFileSize + 1, files: 2, fields: 2, fieldSize: 32 } }))
  async submit(
    @Req() request: SessionRequest,
    @UploadedFiles() files: { grades?: AcademicUpload[]; timetable?: AcademicUpload[] } | undefined,
    @Body() body: Record<string, unknown> | undefined,
  ) {
    const grades = files?.grades?.[0];
    const timetable = files?.timetable?.[0];
    if (!grades && !timetable) {
      throw new BadRequestException('성적표 XLSX 또는 수강신청확인서 PDF를 제출해 주세요.');
    }
    if ((grades && grades.buffer.length > maxFileSize) || (timetable && timetable.buffer.length > maxFileSize)) {
      throw new BadRequestException('파일당 최대 10MB까지 올릴 수 있습니다.');
    }
    if (grades && (!grades.originalname.toLowerCase().endsWith('.xlsx') ||
        !grades.buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 3, 4])))) {
      throw new BadRequestException('성적표 XLSX 형식을 확인해 주세요.');
    }
    if (timetable && (!timetable.originalname.toLowerCase().endsWith('.pdf') ||
        timetable.buffer.subarray(0, 5).toString('ascii') !== '%PDF-')) {
      throw new BadRequestException('수강신청확인서 PDF 형식을 확인해 주세요.');
    }
    const term = timetable && (body?.year !== undefined || body?.termCode !== undefined)
      ? parseSubmissionTerm(body?.year, body?.termCode) : undefined;
    const data = await this.service.submit(request.academicSession!.userId, grades, timetable, term);
    return { data, meta: { requestId: randomUUID() } };
  }
}
