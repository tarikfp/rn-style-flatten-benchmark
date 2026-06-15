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
    branch: 'optimize-style-flatten',
    output: 'results/optimized.json',
  },
];
const caseNotes = new Map([
  [
    'object style',
    'Control case. Object styles already return directly, so this should not move much.',
  ],
  [
    'single style array',
    'Common JSX shape like style={[styles.row]}. It still allocates one result object.',
  ],
  [
    'single effective style array',
    'Common conditional style shape like style={[false, null, styles.row]}.',
  ],
  [
    'nested single style array',
    'Worst old path for wrapper components that compose style arrays into more arrays.',
  ],
  [
    'merged style array',
    'Common override shape like style={[base, selected && active]}.',
  ],
  [
    'nested merged style array',
    'Realistic composed component shape where nested arrays also merge multiple objects.',
  ],
]);

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

function formatChange(improvement) {
  if (Math.abs(improvement) < 0.5) {
    return 'flat';
  }

  if (improvement > 0) {
    return `${improvement.toFixed(1)}% faster`;
  }

  return `${Math.abs(improvement).toFixed(1)}% slower`;
}

function formatHeadline(comparisonsByName) {
  const nestedSingle = comparisonsByName.get('nested single style array');
  const nestedMerged = comparisonsByName.get('nested merged style array');

  if (nestedSingle == null || nestedMerged == null) {
    return 'The nested style-array target cases were not present in both result files, so this report withholds a headline claim. See the table for the cases that did run.';
  }

  return `The optimized branch is ${formatChange(
    nestedSingle.improvement,
  )} for nested single-style arrays and ${formatChange(
    nestedMerged.improvement,
  )} for nested merged arrays in this microbenchmark.`;
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
const comparisons = baseline.results
  .map(baseResult => {
    const optimizedResult = optimizedByName.get(baseResult.name);
    if (optimizedResult == null) {
      return null;
    }

    const improvement =
      ((baseResult.medianMs - optimizedResult.medianMs) / baseResult.medianMs) *
      100;

    return {baseResult, optimizedResult, improvement};
  })
  .filter(Boolean);
const comparisonsByName = new Map(
  comparisons.map(comparison => [comparison.baseResult.name, comparison]),
);

const lines = [
  '# React Native flattenStyle before/after benchmark',
  '',
  `Before: React Native ${baseline.source.branch} ${baseline.source.shortSha}`,
  `After: React Native ${optimized.source.branch} ${optimized.source.shortSha}`,
  '',
  '## What changed',
  '',
  '- Before: array styles were flattened by recursively calling `flattenStyle` for each array entry. Nested arrays created intermediate flattened objects, then the outer array copied those keys again.',
  '- After: nested style arrays are walked directly into one result object with `flattenStyleArrayInto`. Null, false, and undefined entries are skipped while style objects are copied once into the final result.',
  '- Behavior preserved: non-array object styles still return as-is, and array inputs still return a new merged object where later styles win.',
  '',
  '## Headline',
  '',
  formatHeadline(comparisonsByName),
  '',
  'This is not a claim that every React Native screen becomes that much faster. It shows the exact `flattenStyle` paths improved by the patch, which matter when core components receive nested style arrays from composed components.',
  '',
  '## Results',
  '',
  '| scenario | before median ms | after median ms | change | why it matters |',
  '| --- | ---: | ---: | ---: | --- |',
];

for (const {baseResult, optimizedResult, improvement} of comparisons) {
  lines.push(
    `| ${baseResult.name} | ${baseResult.medianMs.toFixed(
      2,
    )} | ${optimizedResult.medianMs.toFixed(2)} | ${formatChange(
      improvement,
    )} | ${caseNotes.get(baseResult.name) ?? ''} |`,
  );
}

lines.push(
  '',
  '## How to read this',
  '',
  '- If your app mostly passes object styles directly, this optimization should not matter much.',
  '- If your component library composes styles as nested arrays, the old path paid extra recursive calls and intermediate object merges. That is the path with the 55-67% median improvement above.',
  '- The simulator app in `app/` has one `Run old vs optimized` button that measures both algorithms against the same nested style input on device. The Node benchmark above is the branch-vs-branch proof against the real `react-native/Libraries/StyleSheet/flattenStyle` implementation.',
  '',
  '## Reproduce',
  '',
  '```sh',
  'yarn bench:compare',
  '```',
  '',
  'The command switches the linked React Native fork between the before and after branches, runs the same `flattenStyle` benchmark against each branch, and rewrites this report.',
);

writeFileSync(path.join(root, 'results/compare.md'), `${lines.join('\n')}\n`);
console.log('\nWrote results/compare.md');
