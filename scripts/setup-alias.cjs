const Module = require('module');
const orig = Module._resolveFilename;
Module._resolveFilename = function(request, parent, isMain, options) {
  if (request === 'react-native') {
    return orig.call(this, 'react-native-web', parent, isMain, options);
  }
  return orig.call(this, request, parent, isMain, options);
};

// Polyfill window & localStorage for Node runtime testing with AsyncStorage
if (typeof global.window === 'undefined') {
  const store = new Map();
  global.window = {
    localStorage: {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => { store.set(key, String(value)); },
      removeItem: (key) => { store.delete(key); },
      clear: () => { store.clear(); },
    },
  };
}
