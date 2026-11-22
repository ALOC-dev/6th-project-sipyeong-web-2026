import type { ParsedCourseRecord } from './parsers/parsed-course-record';

export function buildValidationSummary(
  documentType: ParsedCourseRecord['source']['documentType'],
  records: ParsedCourseRecord[],
) {
  const transcript = documentType === 'transcript';
  return {
    version: 1,
    documentType,
    display: { gradePoint: transcript, gradeValid: transcript },
    courses: records.map((record) => {
      const gradeValid = transcript ? record.gradeValid ?? null : null;
      return {
        year: record.year,
        termCode: record.termCode,
        courseNumber: record.courseNumber,
        courseName: record.courseName,
        category: record.category,
        credits: record.credits,
        gradePoint: transcript ? record.gradePoint ?? null : null,
        gradeValid,
        effectiveGradeValid: gradeValid !== false,
        retake: record.retake ?? null,
      };
    }),
  };
}
