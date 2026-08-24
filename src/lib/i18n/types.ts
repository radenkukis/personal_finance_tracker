/**
 * Bentuk kamus terjemahan.
 *
 * Setiap bahasa harus mengisi SEMUA kunci — TypeScript yang memaksanya.
 * Terjemahan yang setengah jadi menghasilkan layar campur aduk, dan itu
 * lebih buruk daripada tidak menerjemahkan sama sekali.
 */

export const LOCALES = ['en', 'id', 'zh-Hans', 'zh-Hant', 'ja', 'ko', 'es', 'fr', 'de'] as const;
export type Locale = (typeof LOCALES)[number];

/** Nama bahasa ditulis dalam bahasanya sendiri — itu yang dicari orang di daftar. */
export const LOCALE_NAMES: Record<Locale, { native: string; english: string }> = {
  en: { native: 'English', english: 'English' },
  id: { native: 'Bahasa Indonesia', english: 'Indonesian' },
  'zh-Hans': { native: '简体中文', english: 'Chinese (Simplified)' },
  'zh-Hant': { native: '繁體中文', english: 'Chinese (Traditional)' },
  ja: { native: '日本語', english: 'Japanese' },
  ko: { native: '한국어', english: 'Korean' },
  es: { native: 'Español', english: 'Spanish' },
  fr: { native: 'Français', english: 'French' },
  de: { native: 'Deutsch', english: 'German' },
};

/**
 * Bahasa yang parser cepat di HP mengerti. Selain ini, catatan diteruskan
 * ke AI — tetap berfungsi penuh, hanya tidak instan dan memakai kuota.
 */
export const PARSER_LOCALES: Locale[] = ['id', 'en'];

export interface DateNames {
  /** Minggu lebih dulu, mengikuti Date.getDay(). */
  weekdaysShort: readonly string[];
  monthsShort: readonly string[];
  monthsLong: readonly string[];
}

/**
 * Kategori bawaan dikenali lewat slug, bukan namanya, supaya namanya bebas
 * berubah mengikuti bahasa tanpa memutus hubungan dengan transaksi.
 */
export const CATEGORY_SLUGS = [
  'food_drink',
  'transport',
  'shopping',
  'bills',
  'health',
  'entertainment',
  'education',
  'home',
  'social',
  'other',
  'salary',
  'freelance',
  'other_income',
] as const;

export type CategorySlug = (typeof CATEGORY_SLUGS)[number];

export interface Dictionary {
  dates: DateNames;

  common: {
    cancel: string;
    save: string;
    delete: string;
    close: string;
    confirm: string;
    retry: string;
    add: string;
    edit: string;
    done: string;
    all: string;
    expense: string;
    income: string;
    uncategorized: string;
    noPlace: string;
    today: string;
    yesterday: string;
    tomorrow: string;
    unknownError: string;
    notSignedIn: string;
  };

  auth: {
    tagline: string;
    email: string;
    emailHint: string;
    password: string;
    passwordHint: string;
    signIn: string;
    signUp: string;
    toSignUp: string;
    toSignIn: string;
    invalidEmail: string;
    shortPassword: string;
    checkInbox: string;
    notConfiguredTitle: string;
    notConfiguredBody: string;
    notConfiguredHint: string;
    wrongCredentials: string;
    emailNotConfirmed: string;
    alreadyRegistered: string;
    networkError: string;
  };

  tabs: {
    home: string;
    history: string;
    ask: string;
    settings: string;
    addTransaction: string;
  };

  home: {
    greeting: string;
    greetingNamed: string;
    safeToSpend: string;
    overdrawn: string;
    perDayUntilMonthEnd: string;
    overdrawnBody: string;
    spentToday: string;
    remaining: string;
    overBudgetToday: string;
    statIn: string;
    statOut: string;
    statNet: string;
    vsLastMonth: string;
    needToKnow: string;
    dailySpending: string;
    averagePerDay: string;
    projection: string;
    legendSpent: string;
    legendToday: string;
    legendProjected: string;
    whereMoneyGoes: string;
    noSpendingYet: string;
    otherCategories: string;
    recent: string;
    seeAll: string;
    emptyTitle: string;
    emptyBody: string;
    emptyAction: string;
    loadFailedTitle: string;
    loadFailedBody: string;
  };

  add: {
    title: string;
    reviewTitle: string;
    inputPlaceholder: string;
    examples: string;
    /** Kalimat contoh yang bisa ditekan. Ditulis ulang per bahasa, bukan diterjemahkan. */
    samples: readonly string[];
    manualTitle: string;
    manualBody: string;
    parse: string;
    freeModeNote: string;
    parsedOnDevice: string;
    parsedByAI: string;
    manualBadge: string;
    transactionCount: string;
    saveCount: string;
    again: string;
    total: string;
    nothingParsed: string;
    parseFailed: string;
    saveFailed: string;
    nothingSaved: string;
    partiallyParsed: string;
    freeModeUnreadable: string;
    aiUnreachablePartial: string;
    aiUnreachable: string;
  };

  voice: {
    record: string;
    stopAndTranscribe: string;
    recording: string;
    example: string;
    savingRecording: string;
    transcribing: string;
    parsing: string;
    permissionDenied: string;
    micUnavailable: string;
    notSaved: string;
    tooShort: string;
    notHeard: string;
    failed: string;
  };

  editor: {
    amount: string;
    changeKind: string;
    lowConfidence: string;
    merchantPlaceholder: string;
    notePlaceholder: string;
    category: string;
    newCategoryHint: string;
    newBadge: string;
    changeDate: string;
    changeTime: string;
    removeDraft: string;
  };

  history: {
    title: string;
    searchPlaceholder: string;
    filters: string;
    filterKind: string;
    filterTime: string;
    filterAmount: string;
    min: string;
    max: string;
    clearFilters: string;
    resultSummary: string;
    emptyTitle: string;
    emptyBody: string;
    noMatchTitle: string;
    noMatchBody: string;
    recordNow: string;
    hint: string;
    rangeAll: string;
    rangeThisMonth: string;
    rangeLastMonth: string;
    range7: string;
    range30: string;
    deleteTitle: string;
  };

  editScreen: {
    title: string;
    beforeChange: string;
    saveChanges: string;
    deleteTransaction: string;
    notFoundTitle: string;
    notFoundBody: string;
    back: string;
    amountPositive: string;
  };

  chat: {
    title: string;
    subtitle: string;
    placeholder: string;
    send: string;
    thinking: string;
    emptyTitle: string;
    emptyBody: string;
    unavailableTitle: string;
    unavailableBody: string;
    suggestion1: string;
    suggestion2: string;
    suggestion3: string;
    suggestion4: string;
    amendmentTitle: string;
    amendmentSaved: string;
    amendmentNothing: string;
    amendmentMissing: string;
    amendmentCancelled: string;
    failed: string;
    fieldAmount: string;
    fieldKind: string;
    fieldCategory: string;
    fieldMerchant: string;
    fieldNote: string;
  };

  settings: {
    title: string;
    aiMode: string;
    aiOn: string;
    aiOff: string;
    aiOnBody: string;
    aiOffBody: string;
    aiSetupHint: string;
    weeklySummary: string;
    makeSummary: string;
    remakeSummary: string;
    findingsReady: string;
    noFindings: string;
    nickname: string;
    nicknameBody: string;
    nicknamePlaceholder: string;
    nicknameEmpty: string;
    saved: string;
    categories: string;
    manageCategories: string;
    manageCategoriesBody: string;
    keywordsHint: string;
    currency: string;
    currencyExample: string;
    currencyNote: string;
    language: string;
    languageNote: string;
    parserSupported: string;
    parserUnsupported: string;
    yourData: string;
    dataEmail: string;
    dataTransactions: string;
    dataCategories: string;
    dataBalance: string;
    signOut: string;
    privacyNote: string;
    saveFailed: string;
  };

  categories: {
    title: string;
    intro: string;
    expenses: string;
    incomes: string;
    addCategory: string;
    listHint: string;
    keywordCount: string;
    noKeywords: string;
    transactionCount: string;
    namePlaceholder: string;
    nameLabel: string;
    colorLabel: string;
    keywordsLabel: string;
    keywordsHint: string;
    keywordPlaceholder: string;
    noKeywordsYet: string;
    deleteThis: string;
    deleteTitle: string;
    deleteBodyUsed: string;
    deleteBodyUnused: string;
    nameEmpty: string;
    duplicate: string;
  };

  currencyPicker: {
    title: string;
    searchPlaceholder: string;
    noMatch: string;
  };

  languagePicker: {
    title: string;
    searchPlaceholder: string;
    noMatch: string;
    fastParser: string;
    parserNote: string;
    aiOnly: string;
  };

  /** Kalimat temuan — muncul di kartu insight beranda. */
  /** Nama kategori bawaan. Kategori buatan user memakai namanya sendiri. */
  categoryNames: Record<CategorySlug, string>;

  findings: {
    recurringTitle: string;
    recurringDetail: string;
    spikeTitle: string;
    spikeDetail: string;
    surgeTitle: string;
    surgeDetail: string;
    budgetOverTitle: string;
    budgetOverDetail: string;
    budgetRiskTitle: string;
    budgetRiskDetail: string;
  };
}
