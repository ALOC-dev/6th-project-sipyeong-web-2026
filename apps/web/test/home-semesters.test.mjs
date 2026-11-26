import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import ts from 'typescript';

const load = createRequire(import.meta.url);
const previous = load.extensions['.ts'];
load.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
}).outputText, file);
const { getHomeSemesters } = load('../app/home-data.ts');
if (previous) load.extensions['.ts'] = previous;
else delete load.extensions['.ts'];

const overview = (semesterGpas, credits = 0) => ({
  currentTerm: { year: 2026, termCode: '20' }, currentSemester: { credits }, semesterGpas,
});

test('home omits missing and null regular and seasonal GPAs while retaining zero GPAs in chronological order', () => {
  const data = overview([
    { year: 2025, termCode: 'WINTER', gpa: 4.5 },
    { year: 2024, termCode: '20', gpa: null },
    { year: 2025, termCode: 'SUMMER', gpa: 3.5 },
    { year: 2024, termCode: '10', gpa: 0 },
    { year: 2025, termCode: '10', gpa: null },
    { year: 2024, termCode: 'WINTER', gpa: null },
    { year: 2024, termCode: 'SUMMER', gpa: null },
    { year: 2026, termCode: '10', gpa: 4 },
  ]);
  assert.deepEqual(getHomeSemesters(data).map(({ id, gpa }) => [id, gpa]), [
    ['2024/10', 0], ['2025/SUMMER', 3.5], ['2025/WINTER', 4.5], ['2026/10', 4],
  ]);
  assert.deepEqual(getHomeSemesters(overview([])), []);
});

test('current semester retains target GPA only when enrolled and prefers the actual GPA', () => {
  assert.deepEqual(getHomeSemesters(overview([], 18), 3.8), [
    { id: '2026/20', label: '지금', current: true, gpa: 3.8 },
  ]);
  assert.deepEqual(getHomeSemesters(overview([]), 3.8), []);
  assert.deepEqual(getHomeSemesters(overview([], 18)), []);
  assert.equal(getHomeSemesters(overview([{ year: 2026, termCode: '20', gpa: null }], 18), 3.8)[0].gpa, 3.8);
  assert.equal(getHomeSemesters(overview([{ year: 2026, termCode: '20', gpa: 0 }], 18), 3.8)[0].gpa, 0);
});
