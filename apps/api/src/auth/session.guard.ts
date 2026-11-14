import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { readCookie, sessionCookie } from './controller';
import { AuthStore } from './store';

export interface SessionRequest extends Request {
  academicSession?: { userId: string; csrfToken: string };
}

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly store: AuthStore) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<SessionRequest>();
    const token = readCookie(request, sessionCookie);
    const session = token && process.env.DATABASE_URL ? await this.store.session(token) : undefined;
    if (!session) throw new UnauthorizedException('로그인이 필요합니다.');
    request.academicSession = session;
    return true;
  }
}
