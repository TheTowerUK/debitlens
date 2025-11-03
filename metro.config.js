const path = require('path');

module.exports = {
  resolver: {
    extraNodeModules: {
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-native': path.resolve(__dirname, 'node_modules/react-native'),
    },
  },
  watchFolders: [path.resolve(__dirname, 'node_modules')],
};
