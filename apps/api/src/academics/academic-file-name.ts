const utf8 = new TextDecoder('utf-8', { fatal: true });

export function academicFileName(name: string) {
  // Multipart filenames can reach Multer as UTF-8 bytes interpreted as Latin-1.
  if (/[^\x00-\xff]/u.test(name) || !/[\x80-\xff]/u.test(name)) return name;
  try {
    return utf8.decode(Buffer.from(name, 'latin1'));
  } catch {
    return name;
  }
}
