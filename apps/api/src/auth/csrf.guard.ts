import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import type { SessionRequest } from './session.guard';

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<SessionRequest>();
    const origin = process.env.WEB_ORIGIN;
    const supplied = Buffer.from(request.get('X-CSRF-Token') ?? '');
    const expected = Buffer.from(request.academicSession?.csrfToken ?? '');
    if (!origin || !URL.canParse(origin) || request.get('Origin') !== new URL(origin).origin ||
        !expected.length || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      throw new ForbiddenException('요청을 검증할 수 없습니다.');
    }
    return true;
  }
}
