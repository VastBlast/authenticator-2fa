import type { ImportResult } from '../../auth/types';
import { tr } from '../../i18n/messages';

/** Localized explanation for an import that added no accounts. */
export function getImportFailureMessage(result: Pick<ImportResult, 'skipped' | 'errors'>): string {
  return result.errors[0] ?? tr(result.skipped > 0 ? 'importAllDuplicates' : 'importNoneFound');
}
