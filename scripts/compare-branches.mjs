#!/usr/bin/env node

import {execFileSync} from 'child_process';
import {mkdirSync, readFileSync, writeFileSync} from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const branches = [
  {label: 'main', branch: 'main', output: 'results/main.json'},
  {
    label: 'optimized',
    branch: 'codex/optimize-style-flatten',
    output: 'results/optimized.json',
  },
];

function run(command, args) {
  execFileSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  });
}

function loadResult(file) {
  return JSON.parse(readFileSync(path.join(root, file), 'utf8'));
}

mkdirSync(path.join(root, 'results'), {recursive: true});

for (const entry of branches) {
  run('node', ['scripts/use-react-native-branch.mjs', entry.branch, '--install']);
  run('node', ['scripts/flatten-style-node-benchmark.mjs', '--json', entry.output]);
}

const baseline = loadResult(branches[0].output);
const optimized = loadResult(branches[1].output);
const optimizedByName = new Map(
  optimized.results.map(result => [result.name, result]),
);

const lines = [
  '# React Native style flattening benchmark',
  '',
  `Baseline: ${baseline.source.branch} ${baseline.source.shortSha}`,
  `Optimized: ${optimized.source.branch} ${optimized.source.shortSha}`,
  '',
  '| case | baseline median ms | optimized median ms | improvement |',
  '| --- | ---: | ---: | ---: |',
];

for (const baseResult of baseline.results) {
  const optimizedResult = optimizedByName.get(baseResult.name);
  if (optimizedResult == null) {
    continue;
  }

  const improvement =
    ((baseResult.medianMs - optimizedResult.medianMs) / baseResult.medianMs) *
    100;
  lines.push(
    `| ${baseResult.name} | ${baseResult.medianMs.toFixed(
      2,
    )} | ${optimizedResult.medianMs.toFixed(2)} | ${improvement.toFixed(
      1,
    )}% |`,
  );
}

writeFileSync(path.join(root, 'results/compare.md'), `${lines.join('\n')}\n`);
console.log('\nWrote results/compare.md');
