module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // react-native-worklets/plugin MUST be the last plugin — Reanimated 4 depends
    // on it, and animations silently no-op if it is missing or out of order.
    plugins: ['react-native-worklets/plugin'],
  };
};
