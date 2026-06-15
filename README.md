# React Native style flattening benchmark

This repo verifies a React Native `flattenStyle` optimization outside the React Native monorepo.

It links React Native from the fresh fork at `https://github.com/tarikfp/react-native` and compares:

- baseline: `main` at `066c0d8bd8`
- candidate: `codex/optimize-style-flatten` at `81b5bc26b6`

The benchmark app is a normal React Native app in `app/`. Its screen remounts a style-heavy pure RN tree using nested style arrays across `Text`, `Image`, `ImageBackground`, `TextInput`, `TouchableOpacity`, and `ScrollView`.

## Quick commands

```sh
yarn rn:main
yarn bench:js
yarn rn:optimized
yarn bench:js
yarn bench:compare
```

`yarn bench:compare` switches both fork branches, runs the same Node microbenchmark against the linked `react-native/Libraries/StyleSheet/flattenStyle`, and writes `results/compare.md`.

## Latest local result

See `results/compare.md`.

Current run:

| case | baseline median ms | optimized median ms | improvement |
| --- | ---: | ---: | ---: |
| object style | 3.32 | 3.26 | 1.8% |
| single style array | 126.44 | 123.87 | 2.0% |
| single effective style array | 137.06 | 126.59 | 7.6% |
| nested single style array | 295.25 | 98.04 | 66.8% |
| merged style array | 106.06 | 103.11 | 2.8% |
| nested merged style array | 275.93 | 120.98 | 56.2% |

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

The app opens directly to the style-heavy benchmark screen. Press `Run` to collect 15 remount samples on device/simulator.

## Validation

```sh
yarn test
yarn lint
yarn bench:compare
```
