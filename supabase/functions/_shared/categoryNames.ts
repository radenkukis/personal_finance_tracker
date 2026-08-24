/**
 * Nama kategori bawaan per bahasa.
 *
 * DIBUAT OTOMATIS dari sumber yang sama dengan migrasi penyemaian, supaya
 * yang tersimpan di database dan yang dikirim ke model tidak pernah berbeda.
 * Jangan disunting tangan.
 *
 * Model menerima daftar kategori dalam bahasa user — itu yang membuatnya
 * menjawab dengan nama yang benar-benar dilihat user di layar. Aplikasi lalu
 * memetakannya kembali ke baris aslinya lewat slug.
 */

export const CATEGORY_NAMES: Record<string, Record<string, string>> = {
  en: {
    food_drink: 'Food & Drink',
    transport: 'Transport',
    shopping: 'Shopping',
    bills: 'Bills',
    health: 'Health',
    entertainment: 'Entertainment',
    education: 'Education',
    home: 'Home',
    social: 'Social',
    other: 'Other',
    salary: 'Salary',
    freelance: 'Freelance',
    other_income: 'Other income',
  },
  id: {
    food_drink: 'Makan & Minum',
    transport: 'Transport',
    shopping: 'Belanja',
    bills: 'Tagihan',
    health: 'Kesehatan',
    entertainment: 'Hiburan',
    education: 'Pendidikan',
    home: 'Rumah',
    social: 'Sosial',
    other: 'Lainnya',
    salary: 'Gaji',
    freelance: 'Freelance',
    other_income: 'Pemasukan Lain',
  },
  'zh-Hans': {
    food_drink: '餐饮',
    transport: '交通',
    shopping: '购物',
    bills: '账单',
    health: '医疗',
    entertainment: '娱乐',
    education: '教育',
    home: '居家',
    social: '人情',
    other: '其他',
    salary: '工资',
    freelance: '自由职业',
    other_income: '其他收入',
  },
  'zh-Hant': {
    food_drink: '餐飲',
    transport: '交通',
    shopping: '購物',
    bills: '帳單',
    health: '醫療',
    entertainment: '娛樂',
    education: '教育',
    home: '居家',
    social: '人情',
    other: '其他',
    salary: '薪水',
    freelance: '自由工作',
    other_income: '其他收入',
  },
  ja: {
    food_drink: '食費',
    transport: '交通',
    shopping: '買い物',
    bills: '固定費',
    health: '医療',
    entertainment: '娯楽',
    education: '教育',
    home: '住まい',
    social: '交際費',
    other: 'その他',
    salary: '給料',
    freelance: 'フリーランス',
    other_income: 'その他の収入',
  },
  ko: {
    food_drink: '식비',
    transport: '교통',
    shopping: '쇼핑',
    bills: '공과금',
    health: '의료',
    entertainment: '여가',
    education: '교육',
    home: '주거',
    social: '경조사',
    other: '기타',
    salary: '급여',
    freelance: '프리랜서',
    other_income: '기타 수입',
  },
  es: {
    food_drink: 'Comida y bebida',
    transport: 'Transporte',
    shopping: 'Compras',
    bills: 'Facturas',
    health: 'Salud',
    entertainment: 'Ocio',
    education: 'Educación',
    home: 'Hogar',
    social: 'Social',
    other: 'Otros',
    salary: 'Salario',
    freelance: 'Freelance',
    other_income: 'Otros ingresos',
  },
  fr: {
    food_drink: 'Alimentation',
    transport: 'Transport',
    shopping: 'Achats',
    bills: 'Factures',
    health: 'Santé',
    entertainment: 'Loisirs',
    education: 'Éducation',
    home: 'Maison',
    social: 'Social',
    other: 'Autres',
    salary: 'Salaire',
    freelance: 'Freelance',
    other_income: 'Autres revenus',
  },
  de: {
    food_drink: 'Essen & Trinken',
    transport: 'Transport',
    shopping: 'Einkaufen',
    bills: 'Rechnungen',
    health: 'Gesundheit',
    entertainment: 'Freizeit',
    education: 'Bildung',
    home: 'Wohnen',
    social: 'Soziales',
    other: 'Sonstiges',
    salary: 'Gehalt',
    freelance: 'Freelance',
    other_income: 'Sonstige Einnahmen',
  },
};

/**
 * Nama kategori sebagaimana user melihatnya.
 *
 * Slug kosong berarti kategori itu buatan user sendiri — namanya dipakai apa
 * adanya, karena menerjemahkan kata milik user justru salah.
 */
export function shownCategoryName(
  row: { name: string; slug?: string | null },
  language: string | null,
): string {
  if (!row.slug) return row.name;
  const table = CATEGORY_NAMES[language ?? 'en'] ?? CATEGORY_NAMES.en!;
  return table[row.slug] ?? row.name;
}
