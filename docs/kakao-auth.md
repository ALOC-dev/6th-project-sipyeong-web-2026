# 카카오 인증 개발 환경

1. Node.js 24 및 PostgreSQL을 준비한다. 저장소 루트에서 npm ci를 실행한다.
2. 팀장이 적용할 DB를 승인하면 해당 개발 DB에 apps/api/db/001-auth.sql을 한 번 실행한다. 예를 들어 연결 문자열을 DATABASE_URL에 지정한 뒤 psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/api/db/001-auth.sql을 실행한다.
3. apps/api/.env.example을 같은 폴더의 .env로 복사한다. DATABASE_URL, WEB_ORIGIN, KAKAO_REDIRECT_URI, KAKAO_REST_API_KEY와 앱에 설정된 KAKAO_CLIENT_SECRET을 채운다.
4. 카카오 앱에서 카카오 로그인을 활성화하고 KAKAO_REDIRECT_URI와 동일한 URI를 등록한다. 인증과 FE는 같은 공개 Origin을 사용한다. FE 연결 시 그 Origin의 /api 경로를 NestJS로 전달한다.
5. npm run dev로 API를 실행한다. 브라우저에서 /api/auth/login/kakao로 이동하고, 리다이렉트 후 /api/auth/session에서 세션을 확인한다. FE 연결 전에는 콜백 이후 화면 대신 브라우저에서 세션 경로를 직접 확인한다.

| 메서드와 경로 | 동작 |
|---|---|
| GET /api/auth/login/kakao | 인증 시작. returnTo는 서비스 내부 화면 경로 |
| GET /api/auth/login/kakao/callback | 계정 조회·생성 및 세션 발급 후 이동 |
| GET /api/auth/session | 사용자 ID, CSRF 토큰, 세션 만료 시각 조회 |
| POST /api/auth/logout | 같은 Origin에서 세션 응답의 CSRF 토큰을 X-CSRF-Token 헤더로 보내 세션 폐기 |

개발 루프백 HTTP에서는 쿠키의 Secure를 해제한다. 운영 Origin은 HTTPS를 사용한다. 만료된 인증 요청과 세션은 운영 DB에 배치 삭제 절차를 정해 적용한다. 로그인 테스트에 쓰는 DB와 실제 사용자 DB를 구분한다.

[카카오 로그인 REST API](https://developers.kakao.com/docs/ko/kakaologin/rest-api)
