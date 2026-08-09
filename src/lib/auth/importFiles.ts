import { readPortableBackup } from './backup';
import { getErrorMessage } from './errors';
import { decodeQrFiles } from './qr';

export const MAX_IMPORT_FILES = 20;

const MAX_TEXT_FILE_BYTES = 2 * 1024 * 1024;
const IMAGE_NAME_PATTERN = /\.(?:avif|bmp|gif|heic|jpe?g|png|webp)$/i;
const TOO_MANY_FILES_ERROR = `Select ${MAX_IMPORT_FILES} or fewer files at a time.`;
const FILE_TOO_LARGE_ERROR = 'File is too large to import.';
const FILE_UNREADABLE_ERROR = 'File could not be read.';

/** Encrypted backup held back until its password is known. */
export interface EncryptedBackupFile {
  name: string;
  text: string;
}

export interface ImportFileSelection {
  /** Importable text collected from every file that needs no password. */
  text: string;
  /** Backups that still need a password before they can be imported. */
  encrypted: EncryptedBackupFile[];
  /** Reasons individual files were left out. */
  errors: string[];
}

/**
 * Turns a mixed drop of QR images, otpauth/JSON text, and encrypted backups
 * into one importable blob of text plus the backups that need a password.
 */
export async function readImportFiles(files: File[]): Promise<ImportFileSelection> {
  if (files.length > MAX_IMPORT_FILES) {
    throw new Error(TOO_MANY_FILES_ERROR);
  }

  const texts: string[] = [];
  const encrypted: EncryptedBackupFile[] = [];
  const errors: string[] = [];
  const images: File[] = [];

  for (const file of files) {
    if (isImageFile(file)) {
      images.push(file);
      continue;
    }
    if (file.size > MAX_TEXT_FILE_BYTES) {
      errors.push(`${file.name}: ${FILE_TOO_LARGE_ERROR}`);
      continue;
    }

    let text: string;
    try {
      text = await file.text();
    } catch (error) {
      errors.push(`${file.name}: ${getErrorMessage(error, FILE_UNREADABLE_ERROR)}`);
      continue;
    }

    if (readPortableBackup(text)) {
      encrypted.push({ name: file.name, text });
    } else if (text.trim()) {
      texts.push(text);
    }
  }

  if (images.length > 0) {
    try {
      texts.push(...(await decodeQrFiles(images)));
    } catch (error) {
      errors.push(getErrorMessage(error, FILE_UNREADABLE_ERROR));
    }
  }

  return { text: texts.join('\n'), encrypted, errors };
}

function isImageFile(file: File): boolean {
  return file.type.startsWith('image/') || IMAGE_NAME_PATTERN.test(file.name);
}
