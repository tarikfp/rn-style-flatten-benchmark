#!/usr/bin/env node

import {execFileSync} from 'child_process';
import {existsSync, mkdirSync, writeFileSync} from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const vendorParent = path.join(root, '.vendor');
const reactNativeCheckout = path.join(vendorParent, 'react-native');
const defaultRepo = 'https://github.com/tarikfp/react-native.git';

const args = process.argv.slice(2);
const branch = args.find(arg => !arg.startsWith('--')) ?? 'main';
const shouldInstall = args.includes('--install');
const repo = process.env.RN_FORK_URL ?? defaultRepo;

function run(command, commandArgs, cwd = root) {
  execFileSync(command, commandArgs, {
    cwd,
    stdio: 'inherit',
    env: process.env,
  });
}

function read(command, commandArgs, cwd = root) {
  return execFileSync(command, commandArgs, {
    cwd,
    encoding: 'utf8',
    env: process.env,
  }).trim();
}

if (!existsSync(vendorParent)) {
  mkdirSync(vendorParent, {recursive: true});
}

if (!existsSync(path.join(reactNativeCheckout, '.git'))) {
  run('git', ['clone', '--filter=blob:none', repo, reactNativeCheckout]);
} else {
  run('git', ['remote', 'set-url', 'origin', repo], reactNativeCheckout);
}

run('git', ['fetch', 'origin', branch, '--depth', '50'], reactNativeCheckout);
run('git', ['checkout', '--force', '--detach', 'FETCH_HEAD'], reactNativeCheckout);

const sha = read('git', ['rev-parse', 'HEAD'], reactNativeCheckout);
const shortSha = read('git', ['rev-parse', '--short', 'HEAD'], reactNativeCheckout);
const source = {
  repo,
  branch,
  sha,
  shortSha,
  syncedAt: new Date().toISOString(),
};

writeFileSync(
  path.join(root, 'rn-source.json'),
  `${JSON.stringify(source, null, 2)}\n`,
);

console.log(`Linked React Native ${branch} at ${shortSha}`);

if (shouldInstall) {
  run('yarn', ['install', '--check-files'], root);
}
