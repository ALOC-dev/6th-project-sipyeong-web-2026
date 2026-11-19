import { Controller, Get, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ApiExceptionFilter } from './api-exception.filter';
import { AuthModule } from './auth/auth.module';
import { AcademicsModule } from './academics/academics.module';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok' };
  }
}

@Module({
  imports: [AuthModule, AcademicsModule],
  controllers: [HealthController],
  providers: [ApiExceptionFilter, { provide: APP_FILTER, useExisting: ApiExceptionFilter }],
})
export class AppModule {}
