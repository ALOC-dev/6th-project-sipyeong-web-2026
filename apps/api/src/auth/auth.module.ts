import { Module } from '@nestjs/common';
import { AuthController } from './controller';
import { KakaoClient } from './kakao';
import { AuthStore } from './store';

@Module({
  controllers: [AuthController],
  providers: [KakaoClient, AuthStore],
  exports: [AuthStore],
})
export class AuthModule {}
