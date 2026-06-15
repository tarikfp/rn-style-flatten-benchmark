#!/usr/bin/env node

import {createRequire} from 'module';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'fs';
import path from 'path';
import {performance} from 'perf_hooks';
import {fileURLToPath} from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const require = createRequire(path.join(root, 'package.json'));
const args = process.argv.slice(2);
const jsonIndex = args.indexOf('--json');
const jsonOutput = jsonIndex === -1 ? null : args[jsonIndex + 1];

function loadSourceInfo() {
  const sourcePath = path.join(root, 'rn-source.json');
  if (!existsSync(sourcePath)) {
    return null;
  }

  return JSON.parse(readFileSync(sourcePath, 'utf8'));
}

function loadFlattenStyle() {
  const babel = require('@babel/core');
  const flattenStylePath = require.resolve(
    'react-native/Libraries/StyleSheet/flattenStyle',
  );
  const result = babel.transformFileSync(flattenStylePath, {
    babelrc: false,
    configFile: false,
    filename: flattenStylePath,
    plugins: [
      require.resolve('babel-plugin-syntax-hermes-parser'),
      require.resolve('@babel/plugin-transform-flow-strip-types'),
      require.resolve('@babel/plugin-transform-modules-commonjs'),
    ],
  });

  if (result == null || result.code == null) {
    throw new Error(`Unable to transform ${flattenStylePath}`);
  }

  const module = {exports: {}};
  const localRequire = createRequire(flattenStylePath);
  const evaluate = new Function('require', 'module', 'exports', result.code);
  evaluate(localRequire, module, module.exports);

  return {
    flattenStyle: module.exports.default ?? module.exports,
    path: flattenStylePath,
  };
}

const baseStyle = {
  alignItems: 'center',
  backgroundColor: '#ffffff',
  borderColor: '#d1d5db',
  borderRadius: 8,
  borderWidth: 1,
  flexDirection: 'row',
  gap: 8,
  justifyContent: 'space-between',
  marginHorizontal: 4,
  marginVertical: 3,
  opacity: 0.92,
  paddingHorizontal: 10,
  paddingVertical: 8,
  transform: [{scale: 1}],
};

const overrideStyle = {
  backgroundColor: '#dbeafe',
  borderColor: '#2563eb',
  opacity: 0.84,
  paddingVertical: 11,
  transform: [{scale: 1.02}],
};

const rareStyle = {
  borderBottomWidth: 2,
  shadowColor: '#111827',
  shadowOffset: {width: 0, height: 3},
  shadowOpacity: 0.12,
  shadowRadius: 8,
};

const cases = [
  {
    name: 'object style',
    iterations: 700000,
    style: baseStyle,
  },
  {
    name: 'single style array',
    iterations: 700000,
    style: [baseStyle],
  },
  {
    name: 'single effective style array',
    iterations: 700000,
    style: [null, false, undefined, baseStyle],
  },
  {
    name: 'nested single style array',
    iterations: 500000,
    style: [null, [false, [baseStyle]]],
  },
  {
    name: 'merged style array',
    iterations: 450000,
    style: [baseStyle, overrideStyle],
  },
  {
    name: 'nested merged style array',
    iterations: 350000,
    style: [
      null,
      [baseStyle, false],
      [[overrideStyle], undefined],
      [rareStyle, null],
    ],
  },
];

function runCase(flattenStyle, benchmarkCase) {
  let sink = 0;
  const samples = [];

  for (let sample = 0; sample < 11; sample += 1) {
    const startedAt = performance.now();
    for (let i = 0; i < benchmarkCase.iterations; i += 1) {
      const flattened = flattenStyle(benchmarkCase.style);
      sink += flattened?.opacity ?? 0;
    }
    const durationMs = performance.now() - startedAt;
    if (sample >= 2) {
      samples.push(durationMs);
    }
  }

  if (sink === Number.MIN_SAFE_INTEGER) {
    console.log('impossible');
  }

  const sorted = [...samples].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const average =
    samples.reduce((sum, sample) => sum + sample, 0) / samples.length;
  const callsPerSecond = benchmarkCase.iterations / (median / 1000);

  return {
    name: benchmarkCase.name,
    iterations: benchmarkCase.iterations,
    samples,
    medianMs: median,
    averageMs: average,
    minMs: Math.min(...samples),
    maxMs: Math.max(...samples),
    callsPerSecond,
  };
}

const {flattenStyle, path: flattenStylePath} = loadFlattenStyle();
const source = loadSourceInfo();
const results = cases.map(benchmarkCase => runCase(flattenStyle, benchmarkCase));
const payload = {
  source,
  flattenStylePath,
  reactNativeVersion: require('react-native/package.json').version,
  createdAt: new Date().toISOString(),
  results,
};

console.log(
  `React Native ${source?.branch ?? 'unknown'} ${source?.shortSha ?? ''}`,
);
console.log(`flattenStyle: ${flattenStylePath}`);
console.log('');
console.log('| case | median ms | calls/sec |');
console.log('| --- | ---: | ---: |');
for (const result of results) {
  console.log(
    `| ${result.name} | ${result.medianMs.toFixed(2)} | ${Math.round(
      result.callsPerSecond,
    ).toLocaleString('en-US')} |`,
  );
}

if (jsonOutput != null) {
  const outputPath = path.resolve(root, jsonOutput);
  mkdirSync(path.dirname(outputPath), {recursive: true});
  writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`\nWrote ${path.relative(root, outputPath)}`);
}
