/**
 * React Native main no longer ships the package-level config that older
 * templates use to discover built-in platforms. Inject the published CLI
 * platform hooks explicitly while the app links react-native from a fork.
 */

'use strict';

const android = require('@react-native-community/cli-platform-android');
const ios = require('@react-native-community/cli-platform-ios');
const {
  bundleCommand,
  startCommand,
} = require('@react-native/community-cli-plugin');

module.exports = {
  commands: [
    bundleCommand,
    startCommand,
    ...android.commands,
    ...ios.commands,
  ],
  platforms: {
    android: {
      projectConfig: android.projectConfig,
      dependencyConfig: android.dependencyConfig,
    },
    ios: {
      projectConfig: ios.projectConfig,
      dependencyConfig: ios.dependencyConfig,
    },
  },
};
