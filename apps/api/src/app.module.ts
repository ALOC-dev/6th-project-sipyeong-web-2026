import { Controller, Get, Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { AcademicsModule } from './academics/academics.module';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok' };
  }
}

@Module({ imports: [AuthModule, AcademicsModule], controllers: [HealthController] })
export class AppModule {}
