#!/usr/bin/env node

import {execFileSync} from 'child_process';
import {createRequire} from 'module';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const require = createRequire(path.join(root, 'package.json'));
const reactNativeRoot = path.join(root, '.vendor/react-native');
const codegenPackage = path.join(
  reactNativeRoot,
  'packages/react-native-codegen',
);
const reactNativePackage = path.join(reactNativeRoot, 'packages/react-native');

function assertLinkedReactNative() {
  if (!existsSync(reactNativePackage)) {
    throw new Error('Run yarn rn:optimized or yarn rn:main before preparing iOS.');
  }
}

function walkFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const absolute = path.join(dir, entry);
    if (statSync(absolute).isDirectory()) {
      files.push(...walkFiles(absolute));
    } else {
      files.push(absolute);
    }
  }
  return files;
}

function buildCodegenLib() {
  const babel = require('@babel/core');
  const srcDir = path.join(codegenPackage, 'src');
  const libDir = path.join(codegenPackage, 'lib');

  rmSync(libDir, {force: true, recursive: true});

  for (const sourceFile of walkFiles(srcDir)) {
    const relative = path.relative(srcDir, sourceFile);
    const outputFile = path.join(libDir, relative);
    mkdirSync(path.dirname(outputFile), {recursive: true});

    if (!sourceFile.endsWith('.js')) {
      copyFileSync(sourceFile, outputFile);
      continue;
    }

    const result = babel.transformFileSync(sourceFile, {
      babelrc: false,
      configFile: false,
      filename: sourceFile,
      plugins: [
        require.resolve('babel-plugin-syntax-hermes-parser'),
        require.resolve('@babel/plugin-transform-flow-strip-types'),
        require.resolve('@babel/plugin-transform-class-properties'),
        require.resolve('@babel/plugin-transform-optional-chaining'),
        require.resolve('@babel/plugin-transform-nullish-coalescing-operator'),
        require.resolve('@babel/plugin-transform-modules-commonjs'),
      ],
    });

    if (result == null || result.code == null) {
      throw new Error(`Unable to transform ${sourceFile}`);
    }

    writeFileSync(outputFile, `${result.code}\n`);
  }
}

function runReactNativePrepack() {
  execFileSync(process.execPath, ['scripts/prepack.js'], {
    cwd: reactNativePackage,
    stdio: 'inherit',
    env: process.env,
  });
}

assertLinkedReactNative();
console.log('Building @react-native/codegen lib artifacts');
buildCodegenLib();
console.log('Generating React Native iOS package artifacts');
runReactNativePrepack();
