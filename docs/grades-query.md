# 성적 조회와 기본 학점 집계

로그인 세션 쿠키로 본인 성적을 조회합니다. 응답은 data/meta 형식이며 학기 목록과 상세의 limit은 기본 20, 최대 100입니다. 다음 페이지는 meta.nextCursor로 조회합니다. 데이터 버전, 필터 또는 학기가 바뀌면 409 CURSOR_STALE을 반환합니다.

| 경로 | 내용 |
| --- | --- |
| GET /api/grades/summary | 전체 또는 교과구분별 취득학점, 수강 중 학점, GPA |
| GET /api/grades/semesters | 기록이 있는 학기와 학기별 합계 |
| GET /api/grades/semesters/{semesterId} | 학기 전체 합계와 페이지별 과목 기록 |

category는 MAJOR_REQUIRED, MAJOR_ELECTIVE, GENERAL, OTHER, UNCLASSIFIED 또는 MAJOR입니다. MAJOR는 전공필수와 전공선택을 함께 조회합니다. 성적표 교과구분을 사용하며 미확정 교과구분은 UNCLASSIFIED입니다. 기준 과목과 연결되지 않은 기록도 성적표 과목번호·과목명으로 표시합니다. 페이지 크기는 학기 합계에 영향을 주지 않습니다.

## 기본 집계

성적표에 무효로 표시된 기록은 집계에서 제외합니다. 이전에 입력되어 grade_valid가 null인 행 때문에 결과가 달라질 수 있으면 해당 합계를 null로 반환합니다. 같은 성적표를 다시 올리면 유효 여부가 저장됩니다. F0 및 U는 취득학점에서 제외합니다. 공식 등급표에 따라 유효한 F0는 평점에 0점으로 반영하고, S/U는 평점 산정에서 제외합니다. 재수강 과목 연결과 대체 판정은 별도 작업입니다.

[서울시립대학교 등급표](https://www.uos.ac.kr/kor/html/uaInfo/result/manage/manage.do?identified=anonymous) · [학사내규 제46조](https://rule.uos.ac.kr/lmxsrv/law/lawFullContent.srv?SEQ=24&SEQ_HISTORY=2061)

기본 집계 응답의 졸업 기준학점·남은 학점·진행률은 null입니다. basis.catalogVersion의 UNAVAILABLE은 카탈로그를 사용하지 않았음을 표시합니다. 기록 수정용 revision은 성적 보정 기능과 함께 도입할 항목입니다. 학기 조회는 등록된 원본 termCode를 반환하며 현재 학기 플래그는 학사 일정 연동 전까지 false입니다. 확인되지 않은 학기 코드에는 term을 null로 표시합니다.
