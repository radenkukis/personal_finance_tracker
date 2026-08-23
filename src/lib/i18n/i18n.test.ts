import {
  getDictionary,
  interpolate,
  isLocale,
  LOCALES,
  LOCALE_NAMES,
  resolveLocale,
} from './index';
import { en } from './en';

/** Semua jalur kunci di dalam sebuah objek bersarang, sebagai "a.b.c". */
function keyPaths(value: unknown, prefix = ''): string[] {
  if (Array.isArray(value)) return [prefix];
  if (typeof value !== 'object' || value === null) return [prefix];

  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
    keyPaths(v, prefix ? `${prefix}.${k}` : k),
  );
}

/** Nama placeholder di dalam sebuah teks, mis. "{name}" -> "name". */
function placeholders(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1] as string).sort();
}

function stringEntries(value: unknown, prefix = ''): [string, string][] {
  if (typeof value === 'string') return [[prefix, value]];
  if (Array.isArray(value) || typeof value !== 'object' || value === null) return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
    stringEntries(v, prefix ? `${prefix}.${k}` : k),
  );
}

describe('kelengkapan kamus', () => {
  const expected = keyPaths(en).sort();

  for (const locale of LOCALES) {
    it(`${locale} punya seluruh kunci yang sama dengan Inggris`, () => {
      expect(keyPaths(getDictionary(locale)).sort()).toEqual(expected);
    });
  }

  for (const locale of LOCALES) {
    it(`${locale} tidak punya teks kosong`, () => {
      const empty = stringEntries(getDictionary(locale))
        .filter(([, text]) => text.trim().length === 0)
        .map(([key]) => key);
      expect(empty).toEqual([]);
    });
  }
});

describe('kecocokan placeholder', () => {
  const reference = new Map(stringEntries(en).map(([key, text]) => [key, placeholders(text)]));

  for (const locale of LOCALES) {
    it(`${locale} memakai placeholder yang persis sama`, () => {
      /*
       * Ini penjagaan terpenting di berkas ini. Terjemahan yang kehilangan
       * {amount} akan menampilkan kalimat tanpa angka sama sekali — di app
       * keuangan itu bukan cacat kosmetik, melainkan informasi yang hilang.
       */
      const mismatched: string[] = [];
      for (const [key, text] of stringEntries(getDictionary(locale))) {
        const want = reference.get(key) ?? [];
        const got = placeholders(text);
        if (JSON.stringify(want) !== JSON.stringify(got)) {
          mismatched.push(`${key}: harusnya [${want}], tapi [${got}]`);
        }
      }
      expect(mismatched).toEqual([]);
    });
  }
});

describe('nama hari & bulan', () => {
  for (const locale of LOCALES) {
    it(`${locale} punya 7 hari dan 12 bulan`, () => {
      const { dates } = getDictionary(locale);
      expect(dates.weekdaysShort).toHaveLength(7);
      expect(dates.monthsShort).toHaveLength(12);
      expect(dates.monthsLong).toHaveLength(12);
    });
  }
});

describe('nama bahasa', () => {
  it('setiap bahasa punya nama dalam bahasanya sendiri', () => {
    for (const locale of LOCALES) {
      expect(LOCALE_NAMES[locale].native.length).toBeGreaterThan(0);
      expect(LOCALE_NAMES[locale].english.length).toBeGreaterThan(0);
    }
  });
});

describe('getDictionary', () => {
  it('mengembalikan kamus yang diminta', () => {
    expect(getDictionary('id').common.save).toBe('Simpan');
    expect(getDictionary('ja').common.save).toBe('保存');
  });

  it('jatuh ke Inggris untuk kode yang tidak dikenal', () => {
    expect(getDictionary('xx')).toBe(en);
    expect(getDictionary(null)).toBe(en);
    expect(getDictionary(undefined)).toBe(en);
  });
});

describe('isLocale', () => {
  it('hanya menerima kode yang benar-benar didukung', () => {
    expect(isLocale('id')).toBe(true);
    expect(isLocale('zh-Hant')).toBe(true);
    expect(isLocale('xx')).toBe(false);
    expect(isLocale(null)).toBe(false);
  });
});

describe('interpolate', () => {
  it('mengganti placeholder dengan nilainya', () => {
    expect(interpolate('Halo, {name}', { name: 'Brandon' })).toBe('Halo, Brandon');
  });

  it('mengganti angka juga', () => {
    expect(interpolate('{count} transaksi', { count: 3 })).toBe('3 transaksi');
  });

  it('mengganti placeholder yang muncul berkali-kali', () => {
    expect(interpolate('{a} dan {a}', { a: 'x' })).toBe('x dan x');
  });

  it('membiarkan placeholder yang tidak punya nilai, bukan mengosongkannya', () => {
    // Teks aneh langsung terlihat saat diuji; teks yang kosong bisa lolos.
    expect(interpolate('sisa {amount}', {})).toBe('sisa {amount}');
  });

  it('mengembalikan teks apa adanya bila tidak ada nilai sama sekali', () => {
    expect(interpolate('tanpa placeholder')).toBe('tanpa placeholder');
  });
});

describe('memilih bahasa dari perangkat', () => {
  it('memakai kode yang persis sama', () => {
    expect(resolveLocale(['id'])).toBe('id');
    expect(resolveLocale(['zh-Hant'])).toBe('zh-Hant');
  });

  it('tidak peduli besar-kecil huruf maupun garis bawah', () => {
    expect(resolveLocale(['ZH-HANT'])).toBe('zh-Hant');
    expect(resolveLocale(['zh_Hant'])).toBe('zh-Hant');
  });

  it('membuang wilayah bila bahasanya sudah cukup', () => {
    expect(resolveLocale(['en-US'])).toBe('en');
    expect(resolveLocale(['es-MX'])).toBe('es');
    expect(resolveLocale(['de-AT'])).toBe('de');
  });

  it('memilih aksara Mandarin dari wilayahnya', () => {
    // Yang dilaporkan perangkat biasanya cuma negaranya, bukan aksaranya.
    expect(resolveLocale(['zh-TW'])).toBe('zh-Hant');
    expect(resolveLocale(['zh-HK'])).toBe('zh-Hant');
    expect(resolveLocale(['zh-MO'])).toBe('zh-Hant');
    expect(resolveLocale(['zh-CN'])).toBe('zh-Hans');
    expect(resolveLocale(['zh-SG'])).toBe('zh-Hans');
    expect(resolveLocale(['zh'])).toBe('zh-Hans');
  });

  it('melompat ke bahasa berikutnya bila yang pertama tidak didukung', () => {
    expect(resolveLocale(['pt-BR', 'fr-CA'])).toBe('fr');
  });

  it('jatuh ke Inggris bila tidak ada yang cocok', () => {
    expect(resolveLocale(['pt-BR', 'ru'])).toBe('en');
    expect(resolveLocale([])).toBe('en');
    expect(resolveLocale([null, undefined, '  '])).toBe('en');
  });
});
