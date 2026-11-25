# 중간 발표 — 민우 담당 원고

범위: 3-2 ERD, 3-3 데이터 구조, 4 API 설계 및 구현 현황. 총 2분, 본문 3장. 별도 표지와 다른 발표자의 내용은 추가하지 않는다.

기준: 2026-11-25 원격 main `30cc284`의 SQL 마이그레이션과 API·웹 구현. 운영 DB·실제 카카오 계정으로 시연한 결과와는 구분한다.

## 1장 · ERD — 40초

화면 문구: **학생의 이수 기록과 졸업 기준을 분리해 연결**

핵심 엔터티와 실제 FK 관계:

- app_users 1 : 0..1 student_profiles — 계정과 학적 정보
- app_users 1 : N student_course_records — 학생별 이수·수강 기록
- semesters 1 : N student_course_records — 학년도·학기
- courses 1 : N course_sections — 기준 과목과 학기별 개설 분반
- courses 1 : N student_course_records — 기준 과목 연결은 선택적
- academic_imports 1 : N student_course_records — 업로드 출처와 검증 이력
- departments 1 : N graduation_requirement_sets 1 : N graduation_requirements
- graduation_requirements N : M courses — graduation_requirement_courses로 연결

Figma에는 계정·프로필, 수강 기록·과목·학기·업로드, 졸업요건의 세 영역으로 배치한다. student_profiles와 졸업요건 집합 사이에는 직접 FK가 없다. 학과와 입학연도 범위로 적용 요건을 선택한다. 보조 테이블은 본문에서 생략하고 발표자 노트에서 설명한다.

발표 원고:

“먼저 ERD입니다. 계정과 학적 정보를 분리하고, 학생을 중심으로 학기별 수강 기록을 연결했습니다. 과목 자체와 학기별 개설 분반도 나눴습니다. 졸업 기준은 학과와 입학연도에 맞는 요건 집합으로 관리하며, 필요한 과목은 연결 테이블로 지정합니다. 업로드 이력과 수강 기록도 연결해, 어떤 파일에서 들어온 데이터인지 추적할 수 있도록 했습니다.”

## 2장 · 데이터 구조 — 35초

화면 문구: **원본 보존 · 상태 구분 · 중복 방지**

| 구조 | 주요 필드·규칙 | 목적 |
| --- | --- | --- |
| 학적 정보 | department_id, admission_year, curriculum_year | 학생별 적용 기준 선택 |
| 수강 기록 | user_id, semester_id, course_number_snapshot의 UNIQUE | 같은 학기의 동일 과목 재업로드 시 갱신 |
| 과목 스냅샷 | course_name_snapshot, credits, grade, grade_valid | 기준 과목과 미연결 상태여도 기록 보존 |
| 상태와 출처 | completed/enrolled/withdrawn, source_import_id | 이수·수강 구분과 업로드 추적 |
| 변경 버전 | revision, student_data_version | 학적 정보 동시 수정 충돌과 성적 커서 만료 감지 |

발표 원고:

“수강 기록에는 원본 과목명과 학점, 성적, 성적 유효 여부를 저장합니다. 기준 과목과 연결되지 않아도 원본 기록을 보존합니다. 학생·학기·과목번호 조합을 유일하게 두어 재업로드 시 중복 생성 대신 갱신하고, 다른 학기의 재수강 기록은 별도로 남깁니다. 또 이수 완료와 수강 중을 구분해 취득학점과 예상학점 계산에 활용합니다.”

## 3장 · API 설계와 구현 현황 — 45초

화면 문구: **로그인 → 학적 저장 → 자료 업로드 → 분석 조회**

| 기능 | 대표 API | main 구현 |
| --- | --- | --- |
| 카카오 로그인·세션 | GET /api/auth/login/kakao, GET /api/auth/session | 구현 |
| 학적 정보 | GET /api/users/me, PATCH /api/users/me/profile | 구현 |
| 파일 업로드 | POST /api/academics/imports | XLSX·PDF 개별/동시 업로드 구현 |
| 성적 조회 | GET /api/grades/summary, GET /api/grades/semesters, GET /api/grades/semesters/:semesterId | 집계·페이지 조회 구현 |
| 졸업요건·홈 | GET /api/me/graduation, GET /api/me/summary | 판정·요약 구현 |
| 강의 로드맵 | GET /api/me/roadmap | 카탈로그·이수·수강 정보 제공 구현 |

슬라이드에는 위 기능군과 대표 경로 4~5개만 남긴다. 전체 경로는 발표자 노트로 이동한다.

공통: 세션에서 사용자 식별, 변경 요청에 CSRF 검증, 성공 data/meta·오류 error/meta 형식. 학적 저장에 expectedRevision, 성적 페이지에 studentDataVersion 기반 커서 검증.

발표 원고:

“API는 실제 사용자 흐름에 맞춰 구성했습니다. 카카오 로그인 후 학적 정보를 저장하고, 성적표 엑셀과 수강신청확인서 PDF를 업로드합니다. 저장된 자료로 성적과 평점을 조회하고, 졸업요건 충족 여부와 강의 로드맵을 제공합니다. 현재 이 흐름의 API와 화면 연동이 main에 구현되어 있습니다. 사용자 식별은 세션으로 처리하고, 변경 요청에는 CSRF 검증을 적용했습니다. 학점 플래너 계산은 현재 프론트엔드에서 수행하며, 재수강에 따른 기존 성적 대체는 후속 과제입니다.”

## 구현 현황 설명 시 주의할 점

- Prisma CLI는 SQL 마이그레이션에 사용한다. API 조회·저장은 pg 기반이며 Prisma ORM 모델을 사용한다고 설명하지 않는다.
- 성적 API의 남은 졸업학점 필드는 null이다. 졸업요건 분석은 /api/me/graduation에서 제공한다.
- 플래너·로드맵의 조합 계산 및 일부 설정은 웹에서 처리한다. 별도 시뮬레이션 저장 API가 구현되었다고 설명하지 않는다.
- 실제 판정에는 학과·입학연도별 과목 분류, 졸업요건 및 개설 강의 데이터가 필요하다. 스키마 생성만으로 모든 학과의 판정이 준비되지는 않는다.
- 어학·봉사 입력과 판정은 구현되어 있다. 과거 SQL의 TODO만 보고 미구현으로 설명하지 않는다.
- 재수강 원본 필드는 저장하지만 기존 성적 대체에 따른 공식 누적평점 재산정은 후속 과제다.

## 코드 근거

- ERD·제약: apps/api/prisma/migrations/001_auth ~ 010_graduation_credit_recognition
- API: apps/api/src/{auth,profile,academics,grades,overview,student-info}
- 원자적 업로드·갱신: apps/api/src/academics/academics.store.ts
- 졸업요건 계산: apps/api/src/overview/overview.calculator.ts
- 플래너 계산: apps/web/app/grade-plan-provider.tsx 및 grades/grade-utils.ts
- API 계약: docs/kakao-auth.md, profile-registration.md, academic-upload.md, grades-query.md

Figma 제작 전 필요한 자료: 원하는 발표 레퍼런스와 사용할 양식이 들어 있는 Figma 파일·페이지 링크. 제공 후 해당 스타일에 맞춰 담당 본문 3장을 제작한다.
