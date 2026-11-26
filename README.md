# 시평

서울시립대학교 학생을 위한 학점 관리 및 졸업요건 분석 서비스.

## 다른 PC에서 프론트 + 백엔드 실행

Node.js 24를 설치하고 저장소 루트에서 실행한다. DB는 팀 공용 Neon PostgreSQL을 사용하므로 로컬 PostgreSQL 설치나 덤프 복원은 필요 없다.

1. `npm ci`를 실행한다.
2. `apps/api/.env.example`을 `apps/api/.env`로 복사한다. 팀에서 안전하게 전달받은 Neon 연결 문자열을 `DATABASE_URL`에 넣고 `KAKAO_REST_API_KEY`, `KAKAO_CLIENT_SECRET`을 채운다. 기존 개발자의 `apps/api/.env`를 안전하게 전달받아 사용해도 된다. 환경 파일은 Git에서 제외되며 비밀번호와 키는 커밋하지 않는다.
3. 터미널 두 개에서 각각 실행한다.

```sh
# 터미널 1: 백엔드 3003
npm run dev

# 터미널 2: 프론트 3001
npm run dev:web
```

브라우저에서 [서비스](http://localhost:3001)와 [API 상태](http://localhost:3001/api/health)를 확인한다. 프론트가 `/api`를 같은 PC의 백엔드 `127.0.0.1:3003`으로 전달하고 백엔드가 Neon에 연결한다. 카카오 앱에는 `http://localhost:3001/api/auth/login/kakao/callback`이 등록되어 있어야 한다. 접속 주소는 `localhost`를 사용한다.

공용 DB에는 기존 기준 데이터와 사용자 데이터가 있다. PC마다 DB를 초기화하거나 덤프를 다시 복원하지 않는다. 상태 조회는 `npm run db:status`이고 스키마 변경은 담당자가 [마이그레이션 안내](apps/api/prisma/README.md)에 따라 적용한다.

XLSX/PDF 업로드까지 사용하려면 [업로드 안내](docs/academic-upload.md)의 Python 가상환경과 의존성을 설치한다. VS Code에서는 **Tasks: Run Task → 시평: 프론트 + 백엔드 실행**으로도 실행할 수 있다.

검증은 `npm run typecheck`, `npm test`, `npm run build`로 실행한다.

팀원 작업 방법은 [협업 안내](docs/collaboration.md)를 참고한다.

카카오 로그인 설정과 검증은 [인증 개발 환경](docs/kakao-auth.md)을 참고한다.
