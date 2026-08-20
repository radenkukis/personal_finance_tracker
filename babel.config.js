module.exports = function (api) {
  api.cache(true);
  // babel-preset-expo (SDK 57) sudah memasang plugin Reanimated/worklets
  // secara otomatis. Jangan tambahkan plugin itu manual — malah bentrok.
  return {
    presets: ['babel-preset-expo'],
  };
};
