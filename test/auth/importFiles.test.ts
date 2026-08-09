import { describe, expect, test } from 'vitest';
import { createEncryptedBackupFile } from '../../src/lib/auth/backup';
import { MAX_IMPORT_FILES, readImportFiles } from '../../src/lib/auth/importFiles';
import type { AppSettings } from '../../src/lib/auth/types';
import { DEFAULT_SETTINGS } from '../../src/lib/auth/types';

const ALICE_URI = 'otpauth://totp/Example:alice@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Example';
const PASSWORD = 'correct horse battery staple';
const settings: AppSettings = { ...DEFAULT_SETTINGS };

describe('readImportFiles', () => {
  test('collects plain text files into a single importable blob', async () => {
    const selection = await readImportFiles([
      textFile('codes.txt', ALICE_URI),
      textFile('empty.txt', '   '),
      textFile('vault.json', '{"accounts":[]}')
    ]);

    expect(selection.text).toBe(`${ALICE_URI}\n{"accounts":[]}`);
    expect(selection.encrypted).toEqual([]);
    expect(selection.errors).toEqual([]);
  });

  test('holds encrypted backups back until a password is known', async () => {
    const backup = await createEncryptedBackupFile([], settings, PASSWORD);
    const selection = await readImportFiles([
      new File([await backup.blob.text()], 'backup.json', { type: 'application/json' }),
      textFile('codes.txt', ALICE_URI)
    ]);

    expect(selection.text).toBe(ALICE_URI);
    expect(selection.encrypted).toHaveLength(1);
    expect(selection.encrypted[0].name).toBe('backup.json');
    expect(selection.encrypted[0].text).toContain('2fa-authenticator');
  });

  test('reports oversized files without dropping the readable ones', async () => {
    const selection = await readImportFiles([
      new File([new Uint8Array(3 * 1024 * 1024)], 'huge.txt', { type: 'text/plain' }),
      textFile('codes.txt', ALICE_URI)
    ]);

    expect(selection.text).toBe(ALICE_URI);
    expect(selection.errors).toEqual(['huge.txt: File is too large to import.']);
  });

  test('reports unreadable QR images without dropping text files', async () => {
    const selection = await readImportFiles([
      textFile('codes.txt', ALICE_URI),
      new File([new Uint8Array(8)], 'screenshot.png', { type: 'image/png' })
    ]);

    expect(selection.text).toBe(ALICE_URI);
    expect(selection.errors).toHaveLength(1);
    expect(selection.encrypted).toEqual([]);
  });

  test('rejects oversized selections before reading anything', async () => {
    const files = Array.from({ length: MAX_IMPORT_FILES + 1 }, (_, index) =>
      textFile(`codes-${index}.txt`, ALICE_URI)
    );

    await expect(readImportFiles(files)).rejects.toThrow(
      `Select ${MAX_IMPORT_FILES} or fewer files at a time.`
    );
  });
});

function textFile(name: string, contents: string): File {
  return new File([contents], name, { type: 'text/plain' });
}
