export type MessageKey =
  | 'appName'
  | 'tagline'
  | 'setupTitle'
  | 'unlockTitle'
  | 'password'
  | 'newPassword'
  | 'confirmPassword'
  | 'createVault'
  | 'unlock'
  | 'lock'
  | 'accounts'
  | 'transfer'
  | 'addAccount'
  | 'addManual'
  | 'addQr'
  | 'addQrDescription'
  | 'addPaste'
  | 'addPasteDescription'
  | 'editAccount'
  | 'save'
  | 'cancel'
  | 'issuer'
  | 'account'
  | 'secret'
  | 'type'
  | 'algorithm'
  | 'digits'
  | 'period'
  | 'counter'
  | 'pinned'
  | 'totp'
  | 'hotp'
  | 'steam'
  | 'search'
  | 'empty'
  | 'copy'
  | 'next'
  | 'edit'
  | 'delete'
  | 'showQr'
  | 'import'
  | 'export'
  | 'importExport'
  | 'settings'
  | 'manual'
  | 'qrImage'
  | 'importText'
  | 'importFile'
  | 'importTitle'
  | 'importEncrypted'
  | 'backupPassword'
  | 'exportTitle'
  | 'exportOtp'
  | 'exportEncrypted'
  | 'plainWarning'
  | 'appearance'
  | 'preferences'
  | 'security'
  | 'currentPassword'
  | 'setPassword'
  | 'changePassword'
  | 'removePassword'
  | 'passwordProtectionOn'
  | 'passwordProtectionOff'
  | 'deleteVault'
  | 'deleteVaultConfirm'
  | 'codeDisplay'
  | 'language'
  | 'theme'
  | 'light'
  | 'dark'
  | 'copyWithSpaces'
  | 'scanPage'
  | 'scanPageStart'
  | 'scanPageWaiting'
  | 'scanPageNoQr'
  | 'scanPageFailed'
  | 'scanPageUnavailable';

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'ar', label: 'العربية' },
  { code: 'bn', label: 'বাংলা' },
  { code: 'pt', label: 'Português' },
  { code: 'ru', label: 'Русский' },
  { code: 'ja', label: '日本語' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'zh', label: '简体中文' }
];

const en: Record<MessageKey, string> = {
  appName: 'Authenticator',
  tagline: 'Secure 2FA codes for Chrome, Edge, and Firefox.',
  setupTitle: 'Create encrypted vault',
  unlockTitle: 'Unlock vault',
  password: 'Password',
  newPassword: 'New password',
  confirmPassword: 'Confirm password',
  createVault: 'Create vault',
  unlock: 'Unlock',
  lock: 'Lock',
  accounts: 'Codes',
  transfer: 'Transfer',
  addAccount: 'Add account',
  addManual: 'Manual',
  addQr: 'QR code',
  addQrDescription: 'Upload a QR image or select a QR code on the current page.',
  addPaste: 'Paste',
  addPasteDescription: 'Paste an otpauth link, Google Authenticator transfer text, or another supported authenticator export.',
  editAccount: 'Edit account',
  save: 'Save',
  cancel: 'Cancel',
  issuer: 'Issuer',
  account: 'Account',
  secret: 'Secret',
  type: 'Type',
  algorithm: 'Algorithm',
  digits: 'Digits',
  period: 'Period',
  counter: 'Counter',
  pinned: 'Pinned',
  totp: 'Time-based',
  hotp: 'Counter-based',
  steam: 'Steam',
  search: 'Search',
  empty: 'No accounts yet.',
  copy: 'Copy',
  next: 'Next',
  edit: 'Edit',
  delete: 'Delete',
  showQr: 'Show QR',
  import: 'Import',
  export: 'Export',
  importExport: 'Import/export',
  settings: 'Settings',
  manual: 'Manual',
  qrImage: 'QR image',
  importText: 'Paste otpauth, Google migration, or backup text',
  importFile: 'Text or JSON file',
  importTitle: 'Import',
  importEncrypted: 'Import encrypted backup',
  backupPassword: 'Backup password',
  exportTitle: 'Export',
  exportOtp: 'Export otpauth text',
  exportEncrypted: 'Export encrypted backup',
  plainWarning: 'Plain otpauth exports contain live secrets.',
  appearance: 'Appearance',
  preferences: 'Preferences',
  security: 'Security',
  currentPassword: 'Current password',
  setPassword: 'Set password',
  changePassword: 'Change password',
  removePassword: 'Remove password',
  passwordProtectionOn: 'Password protection is on.',
  passwordProtectionOff: 'Password protection is off.',
  deleteVault: 'Delete vault and password',
  deleteVaultConfirm: 'Type DELETE to remove all saved accounts.',
  codeDisplay: 'Code display',
  language: 'Language',
  theme: 'Theme',
  light: 'Light',
  dark: 'Dark',
  copyWithSpaces: 'Copy codes with spacing',
  scanPage: 'Scan page',
  scanPageStart: 'Select QR on page',
  scanPageWaiting: 'Select the QR code area in the page.',
  scanPageNoQr: 'No QR code was found in that selection.',
  scanPageFailed: 'Page scan failed. Try a tighter selection or use QR image import.',
  scanPageUnavailable: 'Page scan is unavailable in this browser context.'
};

const dictionaries: Record<string, Partial<Record<MessageKey, string>>> = {
  en,
  es: {
    appName: 'Autenticador',
    tagline: 'Códigos 2FA seguros para Chrome, Edge y Firefox.',
    setupTitle: 'Crear bóveda cifrada',
    unlockTitle: 'Desbloquear bóveda',
    password: 'Contraseña',
    createVault: 'Crear bóveda',
    unlock: 'Desbloquear',
    lock: 'Bloquear',
    addAccount: 'Agregar cuenta',
    import: 'Importar',
    export: 'Exportar',
    settings: 'Ajustes',
    copy: 'Copiar',
    delete: 'Eliminar',
    language: 'Idioma',
    theme: 'Tema'
  },
  hi: {
    appName: 'प्रमाणक',
    tagline: 'Chrome, Edge और Firefox के लिए सुरक्षित 2FA कोड।',
    setupTitle: 'एन्क्रिप्टेड वॉल्ट बनाएं',
    unlockTitle: 'वॉल्ट अनलॉक करें',
    password: 'पासवर्ड',
    createVault: 'वॉल्ट बनाएं',
    unlock: 'अनलॉक',
    lock: 'लॉक',
    addAccount: 'खाता जोड़ें',
    import: 'आयात',
    export: 'निर्यात',
    settings: 'सेटिंग्स',
    copy: 'कॉपी',
    delete: 'हटाएं',
    language: 'भाषा',
    theme: 'थीम'
  },
  ar: {
    appName: 'المصادِق',
    tagline: 'رموز 2FA آمنة لمتصفحات Chrome وEdge وFirefox.',
    setupTitle: 'إنشاء خزنة مشفرة',
    unlockTitle: 'فتح الخزنة',
    password: 'كلمة المرور',
    createVault: 'إنشاء الخزنة',
    unlock: 'فتح',
    lock: 'قفل',
    addAccount: 'إضافة حساب',
    import: 'استيراد',
    export: 'تصدير',
    settings: 'الإعدادات',
    copy: 'نسخ',
    delete: 'حذف',
    language: 'اللغة',
    theme: 'السمة'
  },
  bn: {
    appName: 'অথেন্টিকেটর',
    tagline: 'Chrome, Edge এবং Firefox-এর জন্য নিরাপদ 2FA কোড।',
    setupTitle: 'এনক্রিপ্টেড ভল্ট তৈরি করুন',
    unlockTitle: 'ভল্ট খুলুন',
    password: 'পাসওয়ার্ড',
    createVault: 'ভল্ট তৈরি',
    unlock: 'খুলুন',
    lock: 'লক',
    addAccount: 'অ্যাকাউন্ট যোগ করুন',
    import: 'ইমপোর্ট',
    export: 'এক্সপোর্ট',
    settings: 'সেটিংস',
    copy: 'কপি',
    delete: 'মুছুন',
    language: 'ভাষা',
    theme: 'থিম'
  },
  pt: {
    appName: 'Autenticador',
    tagline: 'Códigos 2FA seguros para Chrome, Edge e Firefox.',
    setupTitle: 'Criar cofre criptografado',
    unlockTitle: 'Desbloquear cofre',
    password: 'Senha',
    createVault: 'Criar cofre',
    unlock: 'Desbloquear',
    lock: 'Bloquear',
    addAccount: 'Adicionar conta',
    import: 'Importar',
    export: 'Exportar',
    settings: 'Configurações',
    copy: 'Copiar',
    delete: 'Excluir',
    language: 'Idioma',
    theme: 'Tema'
  },
  ru: {
    appName: 'Аутентификатор',
    tagline: 'Безопасные 2FA-коды для Chrome, Edge и Firefox.',
    setupTitle: 'Создать зашифрованное хранилище',
    unlockTitle: 'Разблокировать хранилище',
    password: 'Пароль',
    createVault: 'Создать',
    unlock: 'Разблокировать',
    lock: 'Заблокировать',
    addAccount: 'Добавить аккаунт',
    import: 'Импорт',
    export: 'Экспорт',
    settings: 'Настройки',
    copy: 'Копировать',
    delete: 'Удалить',
    language: 'Язык',
    theme: 'Тема'
  },
  ja: {
    appName: '認証アプリ',
    tagline: 'Chrome、Edge、Firefox 用の安全な 2FA コード。',
    setupTitle: '暗号化ボールトを作成',
    unlockTitle: 'ボールトを解除',
    password: 'パスワード',
    createVault: '作成',
    unlock: '解除',
    lock: 'ロック',
    addAccount: 'アカウント追加',
    import: 'インポート',
    export: 'エクスポート',
    settings: '設定',
    copy: 'コピー',
    delete: '削除',
    language: '言語',
    theme: 'テーマ'
  },
  fr: {
    appName: 'Authentificateur',
    tagline: 'Codes 2FA sécurisés pour Chrome, Edge et Firefox.',
    setupTitle: 'Créer un coffre chiffré',
    unlockTitle: 'Déverrouiller le coffre',
    password: 'Mot de passe',
    createVault: 'Créer le coffre',
    unlock: 'Déverrouiller',
    lock: 'Verrouiller',
    addAccount: 'Ajouter un compte',
    import: 'Importer',
    export: 'Exporter',
    settings: 'Réglages',
    copy: 'Copier',
    delete: 'Supprimer',
    language: 'Langue',
    theme: 'Thème'
  },
  de: {
    appName: 'Authenticator',
    tagline: 'Sichere 2FA-Codes für Chrome, Edge und Firefox.',
    setupTitle: 'Verschlüsselten Tresor erstellen',
    unlockTitle: 'Tresor entsperren',
    password: 'Passwort',
    createVault: 'Tresor erstellen',
    unlock: 'Entsperren',
    lock: 'Sperren',
    addAccount: 'Konto hinzufügen',
    import: 'Importieren',
    export: 'Exportieren',
    settings: 'Einstellungen',
    copy: 'Kopieren',
    delete: 'Löschen',
    language: 'Sprache',
    theme: 'Design'
  },
  zh: {
    appName: '身份验证器',
    tagline: '适用于 Chrome、Edge 和 Firefox 的安全 2FA 代码。',
    setupTitle: '创建加密保险库',
    unlockTitle: '解锁保险库',
    password: '密码',
    createVault: '创建保险库',
    unlock: '解锁',
    lock: '锁定',
    addAccount: '添加账户',
    import: '导入',
    export: '导出',
    settings: '设置',
    copy: '复制',
    delete: '删除',
    language: '语言',
    theme: '主题'
  }
};

export function t(language: string, key: MessageKey): string {
  return dictionaries[language]?.[key] ?? en[key];
}
