import type { AcademicTerm } from '../../common/academic-term';

export interface ParsedCourseRecord extends AcademicTerm {
  courseNumber: string;
  courseName: string;
  sectionNumber: string | null;
  category: string | null;
  credits: number;
  grade: string | null;
  gradePoint: number | null;
  status: 'completed' | 'enrolled' | 'withdrawn';
  gradeValid: boolean | null;
  retake: boolean | null;
  retakeReference: string | null;
  source: { documentType: 'transcript' | 'enrollment_confirmation'; row: number; sheet?: string; page?: number };
}
