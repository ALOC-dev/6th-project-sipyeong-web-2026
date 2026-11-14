import { Module } from '@nestjs/common';
import { AuthController } from './controller';
import { KakaoClient } from './kakao';
import { AuthStore } from './store';
import { SessionGuard } from './session.guard';
import { CsrfGuard } from './csrf.guard';

@Module({
  controllers: [AuthController],
  providers: [KakaoClient, AuthStore, SessionGuard, CsrfGuard],
  exports: [AuthStore, SessionGuard, CsrfGuard],
})
export class AuthModule {}
