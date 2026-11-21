const { test } = require('node:test');
const assert = require('node:assert/strict');
const { AcademicsController } = require('../dist/academics/academics.controller');
const { AcademicsService } = require('../dist/academics/academics.service');
const transcript = require('../dist/academics/parsers/transcript.parser');
const enrollment = require('../dist/academics/parsers/enrollment-confirmation.parser');
const { currentSubmissionTerm } = require('../dist/common/academic-term');

test('submission term switches at February and August midnight in Seoul', () => {
  for (const [instant, expected] of [
    ['2026-01-31T14:59:59Z', { year: 2025, termCode: '20' }],
    ['2026-01-31T15:00:00Z', { year: 2026, termCode: '10' }],
    ['2026-07-31T14:59:59Z', { year: 2026, termCode: '10' }],
    ['2026-07-31T15:00:00Z', { year: 2026, termCode: '20' }],
    ['2026-12-31T15:00:00Z', { year: 2026, termCode: '20' }],
  ]) assert.deepEqual(currentSubmissionTerm(new Date(instant)), expected);
});

test('controller accepts individual files and assigns the term server-side', async () => {
  const calls = [];
  const controller = new AcademicsController({ submit: async (...args) => { calls.push(args); return {}; } });
  const request = { academicSession: { userId: 'user' } };
  const grades = { originalname: 'grades.xlsx', buffer: Buffer.from([0x50, 0x4b, 3, 4]) };
  const timetable = { originalname: 'timetable.pdf', buffer: Buffer.from('%PDF-') };
  await controller.submit(request, { grades: [grades] }, undefined);
  assert.equal(calls[0][1], grades);
  assert.equal(calls[0][2], undefined);
  assert.equal(calls[0][3], undefined);
  
  await controller.submit(request, { timetable: [timetable] }, { year: '2026', termCode: '20' });
  assert.equal(calls[1][3], undefined);
  await assert.rejects(controller.submit(request, {}, {}));
  await assert.rejects(controller.submit(request, { grades: [{ ...grades, originalname: 'bad.pdf' }] }, {}));
});

test('service parses only supplied documents and saves a combined upload atomically', async (t) => {
  const record = { year: 2026, termCode: '20', courseNumber: '001', credits: 3, gradePoint: null };
  const excelParser = t.mock.method(transcript, 'parseTranscript', async () => [record]);
  const pdfParser = t.mock.method(enrollment, 'parseEnrollmentConfirmation', async () => [record]);
  const batches = [];
  const service = new AcademicsService({ save: async (user, docs) => { batches.push(docs); return {}; } });
  const file = { originalname: 'test', buffer: Buffer.from('test') };

  await service.submit('user', file);
  assert.deepEqual(batches[0].map(doc => doc.type), ['transcript']);
  assert.equal(pdfParser.mock.callCount(), 0);
  await service.submit('user', undefined, file);
  assert.deepEqual(pdfParser.mock.calls[0].arguments[1], currentSubmissionTerm());
  assert.deepEqual(batches[1].map(doc => doc.type), ['enrollment_confirmation']);
  assert.equal(excelParser.mock.callCount(), 1);
  await service.submit('user', file, file);
  assert.deepEqual(batches[2].map(doc => doc.type), ['enrollment_confirmation', 'transcript']);
  await assert.rejects(service.submit('user'));

  excelParser.mock.mockImplementation(async () => { throw new Error('invalid'); });
  await assert.rejects(service.submit('user', file, file));
  assert.equal(batches.length, 3);
});

