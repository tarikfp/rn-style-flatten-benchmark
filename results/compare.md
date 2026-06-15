# React Native flattenStyle before/after benchmark

Before: React Native main 066c0d8bd8
After: React Native optimize-style-flatten 81b5bc26b6

## What changed

- Before: array styles were flattened by recursively calling `flattenStyle` for each array entry. Nested arrays created intermediate flattened objects, then the outer array copied those keys again.
- After: nested style arrays are walked directly into one result object with `flattenStyleArrayInto`. Null, false, and undefined entries are skipped while style objects are copied once into the final result.
- Behavior preserved: non-array object styles still return as-is, and array inputs still return a new merged object where later styles win.

## Headline

The optimized branch is 66.5% faster for nested single-style arrays and 56.2% faster for nested merged arrays in this microbenchmark.

This is not a claim that every React Native screen becomes that much faster. It shows the exact `flattenStyle` paths improved by the patch, which matter when core components receive nested style arrays from composed components.

## Results

| scenario | before median ms | after median ms | change | why it matters |
| --- | ---: | ---: | ---: | --- |
| object style | 3.36 | 3.37 | flat | Control case. Object styles already return directly, so this should not move much. |
| single style array | 126.40 | 124.48 | 1.5% faster | Common JSX shape like style={[styles.row]}. It still allocates one result object. |
| single effective style array | 136.68 | 127.12 | 7.0% faster | Common conditional style shape like style={[false, null, styles.row]}. |
| nested single style array | 294.79 | 98.73 | 66.5% faster | Worst old path for wrapper components that compose style arrays into more arrays. |
| merged style array | 105.79 | 104.25 | 1.5% faster | Common override shape like style={[base, selected && active]}. |
| nested merged style array | 278.54 | 122.06 | 56.2% faster | Realistic composed component shape where nested arrays also merge multiple objects. |

## How to read this

- If your app mostly passes object styles directly, this optimization should not matter much.
- If your component library composes styles as nested arrays, the old path paid extra recursive calls and intermediate object merges. That is the path with the 55-67% median improvement above.
- The simulator app in `app/` has one `Run old vs optimized` button that measures both algorithms against the same nested style input on device. The Node benchmark above is the branch-vs-branch proof against the real `react-native/Libraries/StyleSheet/flattenStyle` implementation.

## Reproduce

```sh
yarn bench:compare
```

The command switches the linked React Native fork between the before and after branches, runs the same `flattenStyle` benchmark against each branch, and rewrites this report.
