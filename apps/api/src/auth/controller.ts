import { Controller, Get, Post, Req, Res, Query } from '@nestjs/common';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import type { CookieOptions, Request, Response } from 'express';
import { KakaoClient } from './kakao';
import { AuthStore, secret } from './store';

export const sessionCookie = 'sipyeong_session';
const flowCookie = 'sipyeong_oauth';
const flowPath = '/api/auth/login/kakao/callback';

export function readCookie(request: Request, name: string) {
  const entry = request.headers.cookie?.split(';').map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`));
  const value = entry?.slice(name.length + 1) ?? '';
  return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : '';
}

function failure(response: Response, status: number, code: string, message: string) {
  return response.status(status).json({
    error: { code, message, details: [] },
    meta: { requestId: randomUUID() },
  });
}

function safeReturnTo(value: unknown, origin: string) {
  if (value === undefined) return '/';
  if (typeof value !== 'string' || value.length > 1024 ||
      !/^\/(?!\/)/.test(value) || /[\\\s\x00-\x1f\x7f]|%(?:2f|5c|0[0-9a-f]|1[0-9a-f]|7f)/i.test(value)) {
    return undefined;
  }
  const url = new URL(value, origin);
  if (url.origin !== origin || /^\/api(?:\/|$)/i.test(url.pathname)) return undefined;
  return url.href;
}

function config() {
  const { DATABASE_URL, WEB_ORIGIN, KAKAO_REST_API_KEY, KAKAO_CLIENT_SECRET, KAKAO_REDIRECT_URI } = process.env;
  if (!DATABASE_URL || !WEB_ORIGIN || !KAKAO_REST_API_KEY || !KAKAO_REDIRECT_URI ||
      !URL.canParse(WEB_ORIGIN) || !URL.canParse(KAKAO_REDIRECT_URI)) return undefined;

  const web = new URL(WEB_ORIGIN);
  const callback = new URL(KAKAO_REDIRECT_URI);
  const loopbackHttp = web.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(web.hostname)
    && process.env.NODE_ENV !== 'production';
  if ((!loopbackHttp && web.protocol !== 'https:') || web.username || web.password ||
      callback.origin !== web.origin || callback.pathname !== flowPath ||
      callback.username || callback.password || callback.search || callback.hash) return undefined;

  return {
    origin: web.origin,
    kakao: { clientId: KAKAO_REST_API_KEY, clientSecret: KAKAO_CLIENT_SECRET, redirectUri: callback.href },
    cookie: { httpOnly: true, sameSite: 'lax', secure: !loopbackHttp } satisfies CookieOptions,
  };
}

function noCache(response: Response) {
  response.set('Cache-Control', 'private, no-store');
}

@Controller('auth')
export class AuthController {
  constructor(private readonly store: AuthStore, private readonly kakao: KakaoClient) {}

  @Get('login/kakao')
  async begin(@Query('returnTo') returnTo: unknown, @Res() response: Response) {
    noCache(response);
    const settings = config();
    if (!settings) return failure(response, 503, 'SERVICE_UNAVAILABLE', '인증 환경을 확인해 주세요.');
    const target = safeReturnTo(returnTo, settings.origin);
    if (!target) return failure(response, 400, 'INVALID_QUERY', '이동 경로를 확인해 주세요.');

    const state = secret();
    const verifier = secret();
    await this.store.saveAttempt(state, verifier, target);
    response.cookie(flowCookie, verifier, { ...settings.cookie, path: flowPath, maxAge: 600_000 });
    return response.redirect(302, this.kakao.authorize(settings.kakao, state));
  }

  @Get('login/kakao/callback')
  async callback(@Req() request: Request, @Res() response: Response) {
    noCache(response);
    const settings = config();
    if (!settings) return failure(response, 503, 'SERVICE_UNAVAILABLE', '인증 환경을 확인해 주세요.');
    const { state, code, error } = request.query;
    const verifier = readCookie(request, flowCookie);
    const target = typeof state === 'string' && /^[A-Za-z0-9_-]{43}$/.test(state) && verifier
      ? await this.store.consumeAttempt(state, verifier)
      : undefined;
    if (!target) return failure(response, 400, 'OAUTH_STATE_INVALID', '인증 요청이 만료되었거나 유효하지 않습니다.');

    response.clearCookie(flowCookie, { ...settings.cookie, path: flowPath });
    const loginError = (reason: string) => response.redirect(302, `${settings.origin}/login?reason=${reason}`);
    if (error === 'access_denied') return loginError('cancelled');
    if (error !== undefined) return loginError('provider_error');
    if (typeof code !== 'string' || !code || code.length > 4096) {
      return failure(response, 400, 'INVALID_QUERY', '인증 코드가 필요합니다.');
    }

    let kakaoId: string;
    try {
      kakaoId = await this.kakao.identity(settings.kakao, code);
    } catch {
      return loginError('provider_error');
    }
    const token = await this.store.createSession(kakaoId, readCookie(request, sessionCookie));
    response.cookie(sessionCookie, token, { ...settings.cookie, path: '/', maxAge: 604_800_000 });
    return response.redirect(302, new URL(target, settings.origin).href);
  }

  @Get('session')
  async session(@Req() request: Request, @Res() response: Response) {
    noCache(response);
    const token = readCookie(request, sessionCookie);
    const data = token && process.env.DATABASE_URL ? await this.store.session(token) : undefined;
    if (!data) return failure(response, 401, 'UNAUTHENTICATED', '로그인이 필요합니다.');
    return response.json({ data, meta: { requestId: randomUUID() } });
  }

  @Post('logout')
  async logout(@Req() request: Request, @Res() response: Response) {
    noCache(response);
    const settings = config();
    if (!settings) return failure(response, 503, 'SERVICE_UNAVAILABLE', '인증 환경을 확인해 주세요.');
    const token = readCookie(request, sessionCookie);
    const session = token ? await this.store.session(token) : undefined;
    if (!session) return failure(response, 401, 'UNAUTHENTICATED', '로그인이 필요합니다.');

    const supplied = Buffer.from(request.get('X-CSRF-Token') ?? '');
    const expected = Buffer.from(session.csrfToken);
    if (request.get('Origin') !== settings.origin || supplied.length !== expected.length ||
        !timingSafeEqual(supplied, expected)) {
      return failure(response, 403, 'CSRF_INVALID', '요청을 검증할 수 없습니다.');
    }

    await this.store.logout(token);
    response.clearCookie(sessionCookie, { ...settings.cookie, path: '/' });
    return response.status(204).end();
  }
}
