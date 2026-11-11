import { Controller, Get, Module } from '@nestjs/common';
import { AuthController } from './auth/controller';
import { AuthStore } from './auth/store';
import { KakaoClient } from './auth/kakao';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok' };
  }
}

@Module({ controllers: [HealthController, AuthController], providers: [AuthStore, KakaoClient] })
export class AppModule {}
