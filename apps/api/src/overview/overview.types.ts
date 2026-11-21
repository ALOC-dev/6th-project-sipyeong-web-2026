export interface CourseRecord {
  record_id: string; course_id: number | null; course_number_snapshot: string;
  course_name_snapshot: string; credits: string; grade: string | null;
  grade_point: string | null; grade_valid: boolean | null; status: string;
  year: number; term_code: string; category_code: string | null;
}
export interface Requirement {
  requirement_id: number; rule_code: string; rule_type: string; title: string;
  category_code: string | null; min_credits: string | null; min_count: number | null;
  min_volunteer_hours: string | null; volunteer_course_alternative: boolean;
  courses: { course_id: number; course_number: string; course_name: string }[];
  options: { exam_type: string; min_score: string | null; accepted_grade: string | null }[];
}
export interface OverviewInput {
  profile: { department_id: number; department_name: string; admission_year: number;
    student_no: string; enrolled_semesters: number | null; academic_status: string | null;
    expected_graduation_year: number | null; expected_graduation_term_code: '10' | '20' | null;
    volunteer_hours: string | null } | null;
  records: CourseRecord[];
  languages: { exam_type: string; score: string | null; grade: string | null }[];
  sets: { requirement_set_id: number; admission_year_from: number; admission_year_to: number | null; source_ref: string }[];
  requirements: Requirement[];
}
