# 학사 자료 업로드

## 외국어·봉사 입력

두 요청 모두 로그인 쿠키, `Origin`, `X-CSRF-Token`과 JSON 본문을 사용한다. 사용자 ID는 세션에서 결정한다. 성공 시 200과 `{ data, meta: { requestId } }`를 반환하며 판정은 이후 졸업요건 조회에서 확인한다.

`PUT /api/me/language-scores`는 `{ "scores": [{ "examType": "TOEIC", "score": 800 }, { "examType": "OPIc", "grade": "IH" }] }`를 받는다. 시험별 점수 또는 등급 하나를 입력한다. 시험 종류는 졸업요건의 exam_type과 일치시킨다. 요청은 기존 어학 성적 목록 전체를 교체하므로 유지할 시험도 함께 보내야 한다. 빈 배열은 전체 삭제다. 시험은 최대 50개, 동일 시험은 하나만 허용한다. 응시일은 이 API에서 입력하지 않는다.

`PATCH /api/me/volunteer-hours`는 `{ "volunteerHours": 20 }`을 받는다. 시간은 누적 총시간이며 0~99999.9, 소수 첫째 자리까지 허용한다. null은 미입력 상태로 초기화한다. 두 입력 API 모두 학생 프로필이 없으면 409를 반환한다. 저장 시 프로필과 학생 데이터 버전이 함께 갱신된다. 입력 검증 오류는 400이다. 봉사 과목 이수에 의한 충족은 입력 시간과 별도로 조회 시 계산한다.

## 홈·졸업요건 조회

세션 쿠키로 `GET /api/me/summary`와 `GET /api/me/graduation`을 호출한다. GET에는 CSRF 헤더가 필요하지 않다. 두 API는 `{ data, meta: { requestId } }`로 반환한다. 요약은 `profile`, `currentTerm`, `gpa`, `credits`, `currentSemester`, `semesterGpas`, `graduation`을 포함한다. 졸업요건 API는 같은 계산의 `requirements`, `counts`, `progressPercent`, `remainingCredits`, `requirementSet`, `warnings`를 최상위에 제공한다.

각 요건에는 `code`, `title`, `type`, `status`(met/expected/unmet/unknown), `unit`, `currentValue`, `projectedValue`, `requiredValue`, `remaining`, `missingCourses`, `enrolledCourses`가 있다. counts.expected는 현재 충족하지 않았지만 이번 학기 과목 이수 시 충족하는 요건 수다. 봉사는 시간 또는 인정 과목 이수 중 하나로 met가 되며 충족 경로를 표시하지 않는다. 외국어 조건은 하나라도 충족하면 met다. 조건 미등록이나 학생 입력 누락은 unknown으로 표시한다.

학점·평점은 성적 조회 API와 같은 규칙으로 집계한다. S는 학점에 포함하고 GPA에서 제외한다. F/F0는 취득학점에서 제외하고 GPA에 0점으로 포함한다. 성적유효여부를 확인할 수 없어 결과가 달라질 수 있으면 해당 집계를 null로 반환한다. 예상학점에서는 이번 학기 동일 과목을 중복 합산하지 않는다. 영역 분류는 학생 학과·입학연도별 course_classifications를 사용한다. 컴퓨터과학부의 교양필수·교양선택 합산 상한은 `graduation_credit_policies`의 48학점이다. `credits.recognized`와 총 학점 요건은 초과분을 차감하며 성적과 누적평점은 유지된다. 인정 상한의 출처와 차감 내역은 `credits.recognition`에 제공한다. 자료가 불충분해 인정학점이 달라질 수 있으면 `credits.recognized`는 null이다. `remainingSemesters`, `expectedGraduationDate`도 정책 미정으로 null이다. 최소 GPA 요건은 현재 스키마에 없어 평점만 반환한다. 학생 프로필·요건·분류 시드 데이터를 등록해야 실제 학생의 판정이 가능하다.

성공 응답의 `data.imports`에는 `importId`와 `validationSummary`가 포함된다. 같은 요약이 `academic_imports.validation_summary`에 저장된다. `courses`의 각 항목은 `year`, `termCode`, `courseNumber`, `courseName`, `category`, `credits`, `gradePoint`, `gradeValid`, `effectiveGradeValid`, `retake`를 제공한다. `gradeValid`는 원본 값이며 미입력은 null이다. `effectiveGradeValid`는 검증 표에서 명시적으로 제외된 행만 구분하며, 실제 집계에는 원본 유효 여부와 성적 정책을 사용한다. 유효 여부와 실제 취득학점 인정 여부는 별도 조건이다.

프론트는 `validationSummary.display.gradePoint`와 `display.gradeValid`가 true인 경우에만 해당 열을 표시한다. PDF 요약은 두 표시 값이 false이고 과목별 평점·성적유효여부는 null이다. 기존 업로드 이력은 자동으로 역산하지 않으며 새 업로드부터 요약이 저장된다.

내 정보 화면에서 선택한 파일을 독립적으로 전송할 수 있다. 엑셀만, PDF만, 두 파일 함께 제출하는 요청을 지원한다. 파일은 최소 하나가 필요하다. 같은 Origin의 `/api`를 NestJS에 전달한다. 로그인 세션 조회 응답의 `data.csrfToken`을 사용한다.

`POST /api/academics/imports`의 multipart 필드

| 필드 | 값 |
| --- | --- |
| `grades` | 성적표 XLSX 한 개, 선택 |
| `timetable` | 수강신청확인서 PDF 한 개, 선택 |
| `year` | PDF의 학년도, 선택 |
| `termCode` | PDF의 학기 코드 `10` 또는 `20`, 선택 |

PDF와 함께 `year`, `termCode`를 보내면 지정한 학기를 사용한다. 두 값을 생략하면 업로드 시점의 한국 시간(Asia/Seoul)으로 서버가 학기를 결정한다. 2월 1일부터 7월 31일까지는 해당 연도 1학기, 8월 1일부터 다음 해 1월 31일까지는 2학기다. 1월 업로드는 전년도 2학기로 저장한다. 엑셀은 문서에 기록된 학기를 사용한다. 결정된 학기 행이 DB에 없으면 422 오류를 반환한다.

```ts
const body = new FormData();
if (grades) body.append('grades', grades);
if (timetable) {
  body.append('timetable', timetable);
}
const response = await fetch('/api/academics/imports', {
  method: 'POST',
  credentials: 'same-origin',
  headers: { 'X-CSRF-Token': csrfToken },
  body,
});
```

브라우저가 multipart 경계를 생성하므로 `Content-Type` 헤더를 직접 설정하지 않는다. 각 파일은 최대 10MB다. 성공 시 201과 `data: { batchId, parsed, saved }`가 반환된다. `parsed`는 두 파일에서 읽은 행 수이고 `saved`는 INSERT 또는 UPDATE된 행 수다. 이미 완료된 성적에 대해 PDF 갱신을 건너뛰면 수가 다를 수 있다. 만료 세션은 401, CSRF 실패는 403, 입력·파싱 오류는 400, DB에 없는 학기는 422다.

로컬 개발에서는 저장소 루트에서 아래 명령으로 API 전용 Python 환경과 추출 의존성을 준비한다.

```powershell
python -m venv apps/api/.venv
& apps/api/.venv/Scripts/python.exe -m pip install -r apps/api/scripts/requirements-academic-parsers.txt
```

macOS·Linux에서는 두 번째 명령의 Python 경로로 `apps/api/.venv/bin/python`을 사용한다. API는 `ACADEMIC_PYTHON`이 있으면 해당 경로를, 없으면 API 폴더의 가상환경을 사용한다. 둘 다 없으면 PATH의 `python`을 사용한다. 배포 환경에도 같은 의존성을 설치한다. 추출 환경이 준비되지 않은 경우 503으로 응답한다.

[DB 마이그레이션 안내](../apps/api/prisma/README.md)에 따라 스키마를 적용하면 2020~2026학년도 정규학기와 계절수업이 기본 등록된다. 성적표의 여름·겨울 계절수업은 해당 학년도의 별도 학기로 저장한다. 다른 학년도는 학교 기준 데이터를 적재해야 한다.
