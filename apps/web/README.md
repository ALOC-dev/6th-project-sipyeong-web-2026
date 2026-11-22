# 시평 프론트엔드

Next.js App Router, React, TypeScript, CSS Modules로 구성한 홈·내 정보 화면입니다.

## 설치·실행

Node.js 24를 사용합니다. 저장소 루트에서 실행하세요.

```powershell
npm ci
npm run dev:web
```

- 홈: http://localhost:3000
- 내 정보: http://localhost:3000/my

개발과 빌드는 Webpack을 사용합니다. 초기 Windows 환경에서 네이티브 SWC를 사용할 수 없어 Turbopack 실행이 실패했던 점을 고려한 설정입니다.

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

## API 연결 전의 예시 데이터

학적 정보, 평점·졸업요건, 추천 과목, 마이크로디그리, 기존 성적표 반영 내역은 화면 확인용 예시입니다. 선택한 파일은 브라우저 메모리에만 보관하며 실제 파싱·업로드는 연결 전입니다. 파일 업로드 제한 10MB도 백엔드 계약에 맞춰 확인할 예시 값입니다.

로그아웃은 `/api/auth/session` 및 `/api/auth/logout`을 호출하도록 작성돼 있습니다. 실제 인증 검증에는 해당 백엔드 브랜치의 환경 설정, 같은 Origin의 `/api` 프록시, `/login` 화면 연결이 필요합니다. 현재 main의 백엔드 초기 설정만으로는 전체 인증 흐름을 실행할 수 없습니다.

## 주요 파일

- `app/page.tsx`: 홈 화면
- `app/my/page.tsx`: 내 정보, 파일 선택, 로그아웃
- `app/theme-provider.tsx`: 공통 테마 상태와 저장·복원
- `app/globals.css`: 라이트·다크 공통 색상
- 각 `page.module.css`: 화면별 배치와 스타일
