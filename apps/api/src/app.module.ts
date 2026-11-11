import { Controller, Get, Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok' };
  }
}

@Module({ imports: [AuthModule], controllers: [HealthController] })
export class AppModule {}
