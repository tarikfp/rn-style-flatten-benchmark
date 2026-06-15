# React Native flattenStyle before/after benchmark

This repo verifies one specific React Native `flattenStyle` optimization outside the React Native monorepo.

It links React Native from the fresh fork at `https://github.com/tarikfp/react-native` and compares:

- before: `main` at `066c0d8bd8`
- after: `optimize-style-flatten` at `81b5bc26b6`

## What changed

Before this patch, array styles were flattened by recursively calling `flattenStyle` for each array entry. When styles were nested, React Native created intermediate flattened objects and then copied their keys into the outer result.

After this patch, nested arrays are walked directly into one final result object. Null, false, and undefined entries are skipped, and style objects are copied once into the final result.

Behavior is intended to stay the same: object styles still return as-is, array inputs still return a new object, and later styles still override earlier styles.

## Headline result

Latest local `yarn bench:compare` result:

| case | before median ms | after median ms | faster by |
| --- | ---: | ---: | ---: |
| nested single style array | 294.79 | 98.73 | 66.5% |
| nested merged style array | 278.54 | 122.06 | 56.2% |

This is not a blanket "React Native is 66.5% faster" claim. It means this exact `flattenStyle` path is much faster when component styles are composed as nested arrays.

The benchmark app is a normal React Native app in `app/`. Its first screen has one main button: `Run old vs optimized`. It first measures the real `StyleSheet.flatten` loaded by the installed simulator build, then measures the old recursive algorithm and the optimized single-pass algorithm against the same nested style payloads.

## Quick commands

```sh
yarn rn:main
yarn bench:js
yarn rn:optimized
yarn bench:js
yarn bench:compare
```

`yarn bench:compare` switches the linked React Native fork between the before and after branches, runs the same Node microbenchmark against `react-native/Libraries/StyleSheet/flattenStyle`, and writes `results/compare.md`.

## Full result

See `results/compare.md` for the generated report with the full table and notes for each scenario.

The short version is:

- Object styles barely matter because `flattenStyle(object)` already returns the object directly.
- Flat arrays get small wins.
- Nested arrays get the large wins because the old implementation paid for recursive calls plus intermediate object merges.

## Simulator

```sh
yarn rn:optimized
yarn pods
yarn start
```

In another terminal:

```sh
yarn ios --simulator "iPhone 17"
```

The app opens directly to the comparison screen. Press `Run old vs optimized` to measure both algorithms on device/simulator. Lower milliseconds is better.

The first results block is the important one when comparing two installed builds:

- A simulator built from `main` should be close to the old recursive numbers.
- A simulator built from `optimize-style-flatten` should be close to the optimized single-pass numbers.
- The controlled old/new block is included on both builds so the input shape and expected before/after gap are visible without switching screens.

For reproducible branch-vs-branch proof without two simulators, use `yarn bench:compare`. It relinks the fork to `main`, runs the benchmark, relinks to `optimize-style-flatten`, runs the same benchmark, and rewrites `results/compare.md`.

## Validation

```sh
yarn test
yarn lint
yarn workspace style-flatten-benchmark-app tsc --noEmit
yarn bench:compare
```
