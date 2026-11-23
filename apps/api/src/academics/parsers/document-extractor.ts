import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

type Cell = string | number | boolean | null;
export interface DocumentTable { name: string; rows: Cell[][] }

export class DocumentExtractorUnavailable extends Error {}

function pythonExecutable() {
  const local = resolve(__dirname, '../../../.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
  return process.env.ACADEMIC_PYTHON || (existsSync(local) ? local : 'python');
}

export function extractTables(file: Buffer, format: 'xlsx' | 'pdf'): Promise<DocumentTable[]> {
  if (!file.length || file.length > 10 * 1024 * 1024) {
    throw new Error('파일 크기는 1바이트부터 10MB까지 허용됩니다.');
  }
  return new Promise((resolveTables, reject) => {
    const child = spawn(pythonExecutable(), [
      resolve(__dirname, '../../../scripts/extract-academic-document.py'), format,
    ], { windowsHide: true, timeout: 30000 });
    const chunks: Buffer[] = [];
    let size = 0;
    child.stdout.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > 8 * 1024 * 1024) {
        child.kill();
        reject(new Error('문서 추출 결과가 너무 큽니다.'));
        return;
      }
      chunks.push(chunk);
    });
    child.stderr.resume();
    child.stdin.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code !== 'EPIPE') reject(error);
    });
    child.on('error', () => reject(new DocumentExtractorUnavailable('문서 추출용 Python을 실행할 수 없습니다.')));
    child.on('close', (code, signal) => {
      if (code === 3) {
        reject(new DocumentExtractorUnavailable('문서 추출용 Python 의존성이 설치되지 않았습니다.'));
        return;
      }
      if (signal) {
        reject(new Error('문서 추출 시간이 초과되었거나 처리 한도를 넘었습니다.'));
        return;
      }
      if (code !== 0) {
        reject(new Error('파일을 읽을 수 없습니다. 포털에서 다시 내려받은 원본 파일로 시도해 주세요.'));
        return;
      }
      try {
        resolveTables(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (error) {
        reject(error);
      }
    });
    child.stdin.end(file);
  });
}

export function text(value: Cell | undefined): string | null {
  return value == null ? null : String(value).trim() || null;
}

export function required(value: Cell | undefined, field: string): string {
  const result = text(value);
  if (!result) throw new Error(`${field} 값이 없습니다.`);
  return result;
}

export function numeric(value: Cell | undefined, field: string): number {
  const raw = required(value, field);
  if (!/^\d+(?:\.\d+)?$/.test(raw) || !Number.isFinite(Number(raw))) {
    throw new Error(`${field} 숫자 형식이 올바르지 않습니다.`);
  }
  return Number(raw);
}

export function flag(value: Cell | undefined, field: string): boolean | null {
  const raw = text(value)?.toUpperCase();
  if (!raw) return null;
  if (raw === 'Y') return true;
  if (raw === 'N') return false;
  throw new Error(`${field} 값은 Y 또는 N이어야 합니다.`);
}

export function headerLabel(value: Cell | undefined): string | undefined {
  return text(value)?.replace(/\s+/g, '');
}
