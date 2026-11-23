import { Controller, Get, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ApiExceptionFilter } from './api-exception.filter';
import { AuthModule } from './auth/auth.module';
import { AcademicsModule } from './academics/academics.module';
import { ProfileModule } from './profile/profile.module';
import { OverviewModule } from './overview/overview.module';
import { StudentInfoModule } from './student-info/student-info.module';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok' };
  }
}

@Module({
  imports: [AuthModule, AcademicsModule, ProfileModule, OverviewModule, StudentInfoModule],
  controllers: [HealthController],
  providers: [ApiExceptionFilter, { provide: APP_FILTER, useExisting: ApiExceptionFilter }],
})
export class AppModule {}
