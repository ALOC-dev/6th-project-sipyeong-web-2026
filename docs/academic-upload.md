# 학사 자료 업로드

`feat/fe-home-myinfo`의 내 정보 화면에서 선택한 `files.grades`와 `files.timetable`을 한 요청에 보낸다. 같은 Origin의 `/api`를 NestJS에 전달한다. 로그인 세션 조회 응답의 `data.csrfToken`을 사용한다.

`POST /api/academics/imports`의 multipart 필드

| 필드 | 값 |
| --- | --- |
| `grades` | 성적표 XLSX 한 개 |
| `timetable` | 수강신청확인서 PDF 한 개 |
| `year` | PDF 대상 학년도, 예: `2026` |
| `termCode` | `10` 또는 `20` |

```ts
const body = new FormData();
body.append('grades', grades);
body.append('timetable', timetable);
body.append('year', String(year));
body.append('termCode', termCode);
const response = await fetch('/api/academics/imports', {
  method: 'POST',
  credentials: 'same-origin',
  headers: { 'X-CSRF-Token': csrfToken },
  body,
});
```

브라우저가 multipart 경계를 생성하므로 `Content-Type` 헤더를 직접 설정하지 않는다. 각 파일은 최대 10MB다. 성공 시 201과 `data: { batchId, parsed, saved }`가 반환된다. `parsed`는 두 파일에서 읽은 행 수이고 `saved`는 INSERT 또는 UPDATE된 행 수다. 이미 완료된 성적에 대해 PDF 갱신을 건너뛰면 수가 다를 수 있다. 만료 세션은 401, CSRF 실패는 403, 입력·파싱 오류는 400, DB에 없는 학기는 422다.

API 실행 환경에 `python -m pip install -r apps/api/scripts/requirements-academic-parsers.txt`로 추출 의존성을 설치한다. 필요하면 `ACADEMIC_PYTHON`에 Python 실행 경로를 지정한다. DB에는 인증·학사 스키마와 해당 학기 행이 필요하다. 기존 학사 스키마를 사용하는 경우 `student_course_records`에 `retake`, `retake_reference` 컬럼이 있는지 확인한다.
