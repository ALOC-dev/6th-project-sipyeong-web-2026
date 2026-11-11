import { Injectable } from '@nestjs/common';

export interface KakaoConfig {
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
}

@Injectable()
export class KakaoClient {
  authorize(config: KakaoConfig, state: string) {
    const url = new URL('https://kauth.kakao.com/oauth/authorize');
    url.search = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      state,
    }).toString();
    return url.href;
  }

  async identity(config: KakaoConfig, code: string): Promise<string> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      code,
    });
    if (config.clientSecret) body.set('client_secret', config.clientSecret);

    const exchange = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(8000),
    });
    if (!exchange.ok) throw new Error('Kakao token exchange failed');
    const token = await exchange.json() as { access_token?: unknown };
    if (typeof token.access_token !== 'string') throw new Error('Kakao token missing');

    const user = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${token.access_token}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!user.ok) throw new Error('Kakao identity lookup failed');

    // Use the original integer text so a 64-bit ID is never rounded by JavaScript.
    const profile = JSON.parse(await user.text(), (key: string, value: unknown, context?: { source: string }) =>
      key === 'id' && typeof value === 'number' ? context?.source : value,
    ) as { id?: unknown };
    if (typeof profile.id !== 'string' || !/^[1-9]\d{0,19}$/.test(profile.id)) {
      throw new Error('Kakao identity missing');
    }
    return profile.id;
  }
}
