# 회원가입 학적 정보 API

카카오 로그인 후 세션 쿠키로 아래 API를 호출합니다. 응답은 공통 data/meta 형식을 따릅니다.

| 요청 | 결과 |
|---|---|
| GET /api/departments?q=컴퓨터&limit=20 | data.items는 departmentId와 name 목록입니다. data.curriculumRules는 조회된 학과의 departmentId, admissionYear, curriculumYear 조합을 반환합니다. 현재 컴퓨터과학부만 지원합니다. |
| GET /api/users/me | data에 userId, displayName, profile, profileCompleted, studentDataVersion을 반환합니다. 학적 정보가 없으면 profile은 null입니다. |
| PATCH /api/users/me/profile | data에 저장된 profile과 studentDataVersion을 반환합니다. 웹 Origin과 세션의 X-CSRF-Token을 보냅니다. |

첫 저장에는 departmentId, admissionYear, curriculumYear와 expectedRevision: 0을 보냅니다. 이후에는 조회한 profile.revision을 expectedRevision으로 보내고 변경할 필드만 포함합니다. 현재 입학연도 입력 범위는 2020~2026입니다. 학번과 봉사시간은 선택이며 null로 지울 수 있습니다. 봉사시간은 0 이상의 숫자이며 소수 첫째 자리까지 입력합니다.

어학성적은 languageScores 배열로 전달합니다. 각 항목은 examType과 score 또는 grade를 가지며 takenAt은 선택 날짜(YYYY-MM-DD)입니다. 예시는 다음과 같습니다.

```json
{
  "departmentId": "34",
  "admissionYear": 2023,
  "curriculumYear": 2023,
  "expectedRevision": 0,
  "volunteerHours": 12.5,
  "languageScores": [
    { "examType": "TOEIC", "score": 850, "takenAt": "2025-03-17" },
    { "examType": "OPIc", "grade": "IH" }
  ]
}
```

languageScores를 생략하면 기존 값이 유지됩니다. 배열을 보내면 전체 교체하고 빈 배열로 삭제합니다. 프로필·어학성적 저장과 버전 증가는 한 트랜잭션으로 처리합니다.

로그인 후 GET /api/users/me의 profileCompleted가 false이면 학적 입력으로, true이면 홈으로 이동합니다. 성적·시간표 업로드, 봉사시간·어학성적은 이 필드의 조건에 포함되지 않습니다. 적용 교육과정 규정이 아직 없으면 저장을 허용하고 meta.warnings에 CURRICULUM_POLICY_UNKNOWN을 반환합니다. 저장된 연도가 등록된 기준과 다르면 CURRICULUM_SELECTION_REQUIRED를 반환합니다.

401은 로그인 필요, 403 CSRF_INVALID는 요청 검증 실패, 409 REVISION_CONFLICT는 재조회 후 재시도 필요, 409 STUDENT_NUMBER_IN_USE는 학번 중복, 422 VALIDATION_ERROR는 입력 확인이 필요함을 뜻합니다.
