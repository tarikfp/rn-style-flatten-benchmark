const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const workspaceRoot = path.resolve(__dirname, '..');
const vendorReactNativeRoot = path.join(workspaceRoot, '.vendor/react-native');

const config = {
  watchFolders: [workspaceRoot, vendorReactNativeRoot],
  resolver: {
    nodeModulesPaths: [
      path.join(__dirname, 'node_modules'),
      path.join(workspaceRoot, 'node_modules'),
    ],
    unstable_enableSymlinks: true,
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
