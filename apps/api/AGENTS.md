# API 작업 규칙

- 관련 API 계약의 경로, 응답, 오류, 인증 정책을 확인한다.
- 계정·세션 변경은 실패 시 상태가 일관되도록 작성한다. 비밀 값은 환경 변수로 전달한다.
- 변경 후 루트에서 npm run typecheck, npm test, npm run build를 실행한다.
