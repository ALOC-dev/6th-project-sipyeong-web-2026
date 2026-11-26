# 시평 프론트엔드

Next.js App Router, React, TypeScript, CSS Modules로 구성한 로그인, 학적 정보, 성적 업로드·조회와 졸업요건을 제공합니다.

## 로컬 연동

Node.js 24를 사용합니다. 저장소 루트에서 `npm ci`를 실행합니다. API 환경 파일은 `apps/api/.env`에 두고, 팀 공용 Neon PostgreSQL에 연결합니다. 로컬 PostgreSQL 설치나 덤프 복원은 필요 없으며, 최초 설정은 [루트 실행 안내](../../README.md)를 따릅니다. DB 연결 문자열과 카카오 키는 API 환경 파일에서 관리합니다.

기존 카카오 콜백이 `http://localhost:3001/api/auth/login/kakao/callback`에 등록된 개발 환경에서는 브라우저가 Next.js의 3001번 포트에 접속하고, Next.js가 `/api`를 NestJS의 3003번 포트로 전달합니다. BE의 `WEB_ORIGIN`은 `http://localhost:3001`이어야 합니다. 등록된 카카오 콜백 URI와 `KAKAO_REDIRECT_URI`를 일치시킵니다.

VS Code에서 저장소 루트 폴더를 엽니다. `Ctrl+Shift+P`에서 **Tasks: Run Task**를 선택하고 **시평: 프론트 + 백엔드 실행**을 실행합니다. 종료할 때는 **Tasks: Terminate Task**에서 두 서버 작업을 종료합니다.

터미널에서 직접 실행하려면 PowerShell 창 두 개를 사용합니다.

```powershell
# API
npm run dev
```

```powershell
# 프론트
npm run dev:web
```

브라우저에서 `http://localhost:3001/api/health`의 200 응답을 확인하고 `http://localhost:3001/`에서 카카오 로그인을 시작합니다. 신규 사용자는 학적 정보를 저장한 뒤 성적표 XLSX를 올립니다. 등록된 사용자는 홈에서 학점 기록을 열거나 내 정보에서 파일을 다시 올릴 수 있습니다.

업로드 검증 전 [업로드 안내](../../docs/academic-upload.md)의 Python 환경을 설정합니다. 공용 DB의 [마이그레이션](../api/prisma/README.md)은 담당자가 적용하며 각 PC에서 DB를 초기화하지 않습니다. 졸업요건은 해당 학과와 입학연도에 적용되는 요건 세트가 필요합니다. 로그인 설정은 [카카오 인증](../../docs/kakao-auth.md)을 참고합니다.

## 검증

저장소 루트에서 실행합니다.

```powershell
npm run lint:web
npm run typecheck
npm test
npm run build
```

프론트의 typecheck는 Next.js 경로 타입을 먼저 생성한 뒤 TypeScript를 검사합니다. 별도의 프론트 테스트 스크립트는 아직 없으며, 루트의 test는 스크립트가 존재하는 워크스페이스의 테스트를 실행합니다. 기존 백엔드 테스트는 계속 실행합니다.

## 현재 구현 범위

- 반응형 홈 및 내 정보 화면
- 평점 구간에 따른 학기별 날씨 아이콘
- 공통 라이트·다크 테마와 브라우저 내 테마 설정 저장
- 성적 Excel 및 수강신청확인서 PDF의 개별 파일 선택 팝업
- 파일 확장자·용량 사전 검사, 선택 취소
- 인증 API의 세션 조회·CSRF 토큰을 사용하는 로그아웃 요청 코드

## 주요 파일

- `app/page.tsx`: 홈 화면
- `app/my/page.tsx`: 내 정보, 파일 선택, 로그아웃
- `app/theme-provider.tsx`: 공통 테마 상태와 저장·복원
- `app/globals.css`: 라이트·다크 공통 색상
- 각 `page.module.css`: 화면별 배치와 스타일
