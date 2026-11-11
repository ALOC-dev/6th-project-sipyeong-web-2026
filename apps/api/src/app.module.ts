import { Controller, Get, Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database';
import { ProfileModule } from './profile/profile.module';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok' };
  }
}

@Module({ imports: [DatabaseModule, AuthModule, ProfileModule], controllers: [HealthController] })
export class AppModule {}
