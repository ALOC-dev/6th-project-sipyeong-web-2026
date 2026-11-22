# DB 마이그레이션

Prisma CLI는 `migrations/*/migration.sql`을 순서대로 적용합니다. API는 `pg`를 사용하며, DB 정의는 버전별 SQL에서 관리합니다.

## 빈 DB와 이후 배포

저장소 루트에서 `npm ci`를 실행합니다. 로컬은 `apps/api/.env`에 `DATABASE_URL`을 설정하고, 배포 환경은 마이그레이션 작업에 대상 DB의 연결 문자열을 주입합니다.

```sh
npm run db:migrate
npm run db:status
```

배포에서는 Prisma CLI 개발 의존성을 설치한 작업에서 `npm run db:migrate`를 실행하고, 성공 후 새 API를 시작합니다. 이후 스키마 변경은 다음 번호의 `migration.sql`로 추가합니다.

## SQL을 수동 적용한 기존 DB

최초 전환 시 대상 DB의 실제 정의를 마이그레이션 SQL과 대조하고, 이미 반영된 버전만 등록합니다. 이전 학사 DB의 `student_course_records`에 `retake`, `retake_reference`가 있는지도 확인합니다. 차이가 있는 버전은 차이를 해소한 뒤 등록합니다.

예를 들어 인증과 학사 스키마가 모두 일치하고 이후 버전이 아직 적용되지 않았다면, 저장소 루트에서 다음 명령을 실행합니다.

```sh
npm exec -w @sipyeong/api -- prisma migrate resolve --applied 001_auth
npm exec -w @sipyeong/api -- prisma migrate resolve --applied 002_academic_records
npm run db:migrate
npm run db:status
```

`migrate resolve --applied`는 적용 이력을 기록합니다. 빈 DB에서는 이 단계를 건너뛰고 `db:migrate`를 실행합니다.
