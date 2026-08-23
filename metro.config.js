const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

/*
 * Supabase CLI membuat berkas kerja di supabase/.temp, dan sebagiannya berupa
 * tautan dengan path tidak lazim (mengandung "?\C:\..."). Pengawas berkas
 * Metro memanggil lstat ke situ, gagal dengan errno -4094 (UNKNOWN), lalu
 * seluruh dev server ikut mati — bukan sekadar melewatkan satu berkas.
 *
 * Folder-folder ini memang tidak pernah dibutuhkan aplikasi, jadi dikeluarkan
 * dari pengawasan sekalian.
 */
config.resolver.blockList = [
  /supabase[\\/]\.temp[\\/].*/,
  /supabase[\\/]\.branches[\\/].*/,
];

module.exports = config;
