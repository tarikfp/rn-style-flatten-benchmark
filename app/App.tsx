/**
 * @format
 */

import React, {useCallback, useMemo, useState} from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';

type StyleObject = {[key: string]: unknown};
type StyleInput =
  | StyleObject
  | null
  | false
  | undefined
  | ReadonlyArray<StyleInput>;
type Algorithm = 'before' | 'after' | 'actual';
type CaseResult = {
  averageMs: number;
  callsPerSecond: number;
  caseName: string;
  improvement: number;
  iterations: number;
  medianMs: number;
  minMs: number;
  oldMedianMs: number;
  shape: string;
};
type BuildResult = Omit<CaseResult, 'improvement' | 'oldMedianMs'>;

const SAMPLE_COUNT = 9;
const WARMUP_SAMPLES = 2;
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
const benchmarkCases = [
  {
    name: 'Nested single style',
    shape: 'style={[null, [false, [baseStyle]]]}',
    iterations: 220000,
    style: [null, [false, [baseStyle]]] satisfies StyleInput,
  },
  {
    name: 'Nested merged styles',
    shape: 'style={[baseStyle, [[overrideStyle]], [rareStyle]]}',
    iterations: 160000,
    style: [
      null,
      [baseStyle, false],
      [[overrideStyle], undefined],
      [rareStyle, null],
    ] satisfies StyleInput,
  },
];
const latestBranchProof = [
  {
    name: 'Nested single style',
    before: '294.79 ms',
    after: '98.73 ms',
    change: '66.5% faster',
  },
  {
    name: 'Nested merged styles',
    before: '278.54 ms',
    after: '122.06 ms',
    change: '56.2% faster',
  },
];

function now(): number {
  const performanceApi = (globalThis as {performance?: {now?: () => number}})
    .performance;

  return performanceApi?.now?.() ?? Date.now();
}

function waitForFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

function round(value: number): string {
  return value.toFixed(2);
}

function median(values: Array<number>): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function average(values: Array<number>): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function flattenStyleBefore(style: StyleInput): StyleObject | undefined {
  if (style === null || typeof style !== 'object') {
    return undefined;
  }

  if (!Array.isArray(style)) {
    return style as StyleObject;
  }

  const result: StyleObject = {};
  for (let i = 0, styleLength = style.length; i < styleLength; i += 1) {
    const computedStyle = flattenStyleBefore(style[i]);
    if (computedStyle == null) {
      continue;
    }

    for (const key in computedStyle) {
      result[key] = computedStyle[key];
    }
  }

  return result;
}

function flattenStyleArrayInto(
  result: StyleObject,
  styles: ReadonlyArray<StyleInput>,
) {
  for (let i = 0, styleLength = styles.length; i < styleLength; i += 1) {
    const style = styles[i];
    if (style === null || typeof style !== 'object') {
      continue;
    }

    if (Array.isArray(style)) {
      flattenStyleArrayInto(result, style);
      continue;
    }

    const styleObject = style as StyleObject;
    for (const key in styleObject) {
      result[key] = styleObject[key];
    }
  }
}

function flattenStyleAfter(style: StyleInput): StyleObject | undefined {
  if (style === null || typeof style !== 'object') {
    return undefined;
  }

  if (!Array.isArray(style)) {
    return style as StyleObject;
  }

  const result: StyleObject = {};
  flattenStyleArrayInto(result, style);
  return result;
}

function runOne(
  algorithm: Algorithm,
  style: StyleInput,
  iterations: number,
): Omit<CaseResult, 'caseName' | 'improvement' | 'oldMedianMs' | 'shape'> {
  const flattenStyle =
    algorithm === 'before'
      ? flattenStyleBefore
      : algorithm === 'after'
        ? flattenStyleAfter
        : (StyleSheet.flatten as unknown as (
            style: StyleInput,
          ) => StyleObject | undefined);
  let sink = 0;
  const samples = [];

  for (let sample = 0; sample < SAMPLE_COUNT; sample += 1) {
    const startedAt = now();
    for (let i = 0; i < iterations; i += 1) {
      const flattened = flattenStyle(style);
      const opacity = flattened?.opacity;
      if (typeof opacity === 'number') {
        sink += opacity;
      }
    }
    const durationMs = now() - startedAt;
    if (sample >= WARMUP_SAMPLES) {
      samples.push(durationMs);
    }
  }

  if (sink === Number.MIN_SAFE_INTEGER) {
    console.log('impossible');
  }

  const medianMs = median(samples);
  return {
    averageMs: average(samples),
    callsPerSecond: iterations / (medianMs / 1000),
    iterations,
    medianMs,
    minMs: Math.min(...samples),
  };
}

function formatChange(improvement: number): string {
  if (improvement >= 0) {
    return `${improvement.toFixed(1)}% faster`;
  }

  return `${Math.abs(improvement).toFixed(1)}% slower`;
}

function ComparisonPanel() {
  return (
    <View style={styles.comparisonPanel}>
      <Text style={styles.panelTitle}>What is being compared?</Text>
      <Text style={styles.panelBody}>
        Same nested style arrays, same number of calls. The only thing that
        changes is the `flattenStyle` algorithm.
      </Text>

      <View style={styles.compareStack}>
        <View style={styles.compareCard}>
          <Text style={styles.compareBadge}>Same input</Text>
          <Text style={styles.compareTitle}>Nested React Native style arrays</Text>
          <Text style={styles.compareBody}>
            Both measurements receive the exact same shape that app components
            commonly pass as{' '}
            {'style={[base, condition && extra, [override]]}'}.
          </Text>
        </View>

        <View style={styles.compareCard}>
          <Text style={styles.compareBadge}>Old algorithm</Text>
          <Text style={styles.compareTitle}>Recursive flattenStyle</Text>
          <Text style={styles.compareBody}>
            React Native main calls `flattenStyle` again for nested arrays. That
            creates temporary objects and then copies their keys into the outer
            result.
          </Text>
        </View>

        <View style={styles.compareCard}>
          <Text style={styles.compareBadge}>Optimized algorithm</Text>
          <Text style={styles.compareTitle}>Single pass flattenStyle</Text>
          <Text style={styles.compareBody}>
            Walks nested arrays directly into one final result object. Falsy
            entries are skipped and style keys are copied once.
          </Text>
        </View>
      </View>

      <View style={styles.inputBox}>
        <Text style={styles.inputLabel}>Measured style shape</Text>
        <Text style={styles.inputCode}>
          style={'{'}[baseStyle, [[overrideStyle]], [rareStyle]]{'}'}
        </Text>
      </View>
    </View>
  );
}

function BranchProofPanel() {
  return (
    <View style={styles.proofBox}>
      <Text style={styles.inputLabel}>Latest branch proof</Text>
      <Text style={styles.proofCaption}>
        From `yarn bench:compare`: old React Native main vs optimized fork.
      </Text>
      {latestBranchProof.map(row => (
        <View key={row.name} style={styles.proofRow}>
          <Text style={styles.proofName}>{row.name}</Text>
          <Text style={styles.proofNumbers}>
            old {row.before}
            {' -> '}
            optimized {row.after}
          </Text>
          <Text style={styles.proofChange}>{row.change}</Text>
        </View>
      ))}
    </View>
  );
}

function ResultRow({result}: {result: CaseResult}) {
  const afterMedian = result.medianMs;

  return (
    <View style={styles.resultRow}>
      <View style={styles.resultHeader}>
        <Text style={styles.resultName}>{result.caseName}</Text>
        <Text style={styles.resultDelta}>{formatChange(result.improvement)}</Text>
      </View>
      <Text style={styles.resultShape}>{result.shape}</Text>
      <View style={styles.metricGrid}>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Old recursive</Text>
          <Text style={styles.metricValue}>{round(result.oldMedianMs)} ms</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>New single pass</Text>
          <Text style={styles.metricValue}>{round(afterMedian)} ms</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Same workload</Text>
          <Text style={styles.metricValue}>
            {Math.round(result.iterations / 1000)}k calls
          </Text>
        </View>
      </View>
    </View>
  );
}

function BuildResultRow({result}: {result: BuildResult}) {
  return (
    <View style={styles.resultRow}>
      <View style={styles.resultHeader}>
        <Text style={styles.resultName}>{result.caseName}</Text>
        <Text style={styles.resultDelta}>{round(result.medianMs)} ms</Text>
      </View>
      <Text style={styles.resultShape}>{result.shape}</Text>
      <View style={styles.metricGrid}>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Actual RN build</Text>
          <Text style={styles.metricValue}>{round(result.medianMs)} ms</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Same workload</Text>
          <Text style={styles.metricValue}>
            {Math.round(result.iterations / 1000)}k calls
          </Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Calls/sec</Text>
          <Text style={styles.metricValue}>
            {Math.round(result.callsPerSecond).toLocaleString()}
          </Text>
        </View>
      </View>
    </View>
  );
}

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';
  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState('Ready');
  const [results, setResults] = useState<Array<CaseResult>>([]);
  const [buildResults, setBuildResults] = useState<Array<BuildResult>>([]);
  const headline = useMemo(() => {
    if (buildResults.length > 0) {
      return buildResults
        .map(result => `${result.caseName}: actual RN ${round(result.medianMs)} ms`)
        .join(' | ');
    }

    if (results.length > 0) {
      return results
        .map(result => `${result.caseName}: ${formatChange(result.improvement)}`)
        .join(' | ');
    }

    return 'Run the installed RN build and the controlled old/new comparison on the same input.';
  }, [buildResults, results]);

  const runComparison = useCallback(async () => {
    setIsRunning(true);
    setResults([]);
    setBuildResults([]);
    setStatus('Measuring old algorithm');
    await waitForFrame();

    const nextResults = [];
    const nextBuildResults = [];
    for (const benchmarkCase of benchmarkCases) {
      setStatus(`Installed RN build: ${benchmarkCase.name}`);
      await waitForFrame();
      const actual = runOne(
        'actual',
        benchmarkCase.style,
        benchmarkCase.iterations,
      );
      nextBuildResults.push({
        ...actual,
        caseName: benchmarkCase.name,
        shape: benchmarkCase.shape,
      });
      setBuildResults([...nextBuildResults]);

      setStatus(`Old recursive: ${benchmarkCase.name}`);
      await waitForFrame();
      const before = runOne(
        'before',
        benchmarkCase.style,
        benchmarkCase.iterations,
      );

      setStatus(`Optimized: ${benchmarkCase.name}`);
      await waitForFrame();
      const after = runOne(
        'after',
        benchmarkCase.style,
        benchmarkCase.iterations,
      );
      const improvement =
        ((before.medianMs - after.medianMs) / before.medianMs) * 100;

      nextResults.push({
        ...after,
        caseName: benchmarkCase.name,
        improvement,
        oldMedianMs: before.medianMs,
        shape: benchmarkCase.shape,
      });
      setResults([...nextResults]);
    }

    setStatus('Done');
    setIsRunning(false);
  }, []);

  return (
    <ScrollView style={styles.screen} contentInsetAdjustmentBehavior="automatic">
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>flattenStyle optimization</Text>
        <Text style={styles.title}>Old vs Optimized flattenStyle</Text>
        <Text style={styles.subtitle}>
          Run the old recursive algorithm and the optimized single-pass fork on
          the same nested style arrays.
        </Text>
      </View>

      <View style={styles.runPanel}>
        <Text style={styles.panelTitle}>Run comparison</Text>
        <Text style={styles.panelBody}>
          The button first measures the real `StyleSheet.flatten` loaded by
          this installed simulator build, then runs the controlled old/new
          algorithm comparison. Lower milliseconds is better.
        </Text>
        <TouchableOpacity
          activeOpacity={0.75}
          disabled={isRunning}
          onPress={runComparison}
          style={[styles.runButton, isRunning && styles.runButtonDisabled]}>
          <Text style={styles.runButtonText}>
            {isRunning ? status : 'Run old vs optimized'}
          </Text>
        </TouchableOpacity>
        <Text style={styles.statusText}>{headline}</Text>
      </View>

      <ComparisonPanel />

      <BranchProofPanel />

      <View style={styles.resultsPanel}>
        <Text style={styles.panelTitle}>Results</Text>
        {buildResults.length > 0 && (
          <View style={styles.actualBox}>
            <Text style={styles.inputLabel}>This simulator's React Native build</Text>
            <Text style={styles.proofCaption}>
              This calls the actual `StyleSheet.flatten` bundled into this app.
              Main should look close to old recursive; optimized should look
              close to new single pass.
            </Text>
            {buildResults.map(result => (
              <BuildResultRow key={result.caseName} result={result} />
            ))}
          </View>
        )}
        {results.length === 0 ? (
          <Text style={styles.emptyText}>
            No run yet. Tap the button above to get the installed RN build time,
            the old recursive time, the optimized single-pass time, and the
            percent change.
          </Text>
        ) : (
          <>
            <Text style={styles.sectionLabel}>Controlled old vs new algorithms</Text>
            {results.map(result => (
              <ResultRow key={result.caseName} result={result} />
            ))}
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f4f6f8',
  },
  hero: {
    paddingTop: 36,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#d1d5db',
  },
  eyebrow: {
    color: '#0f766e',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 4,
    color: '#111827',
    fontSize: 30,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 8,
    color: '#4b5563',
    fontSize: 15,
    lineHeight: 22,
  },
  comparisonPanel: {
    marginHorizontal: 16,
    marginTop: 14,
    padding: 14,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
  },
  compareStack: {
    gap: 8,
    marginTop: 12,
  },
  compareCard: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
  },
  compareBadge: {
    color: '#0f766e',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  compareTitle: {
    marginTop: 4,
    color: '#111827',
    fontSize: 14,
    fontWeight: '800',
  },
  compareBody: {
    marginTop: 6,
    color: '#374151',
    fontSize: 12,
    lineHeight: 17,
  },
  inputBox: {
    marginTop: 12,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#eef2ff',
  },
  inputLabel: {
    color: '#312e81',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  inputCode: {
    marginTop: 4,
    color: '#111827',
    fontSize: 12,
    fontWeight: '700',
  },
  proofBox: {
    marginHorizontal: 16,
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#ecfdf5',
  },
  proofCaption: {
    marginTop: 4,
    color: '#374151',
    fontSize: 12,
    lineHeight: 17,
  },
  proofRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#a7f3d0',
  },
  proofName: {
    color: '#111827',
    fontSize: 12,
    fontWeight: '800',
  },
  proofNumbers: {
    marginTop: 3,
    color: '#374151',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  proofChange: {
    marginTop: 3,
    color: '#047857',
    fontSize: 12,
    fontWeight: '800',
  },
  runPanel: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
  },
  panelTitle: {
    color: '#111827',
    fontSize: 17,
    fontWeight: '800',
  },
  panelBody: {
    marginTop: 6,
    color: '#4b5563',
    fontSize: 13,
    lineHeight: 19,
  },
  runButton: {
    marginTop: 12,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#0f766e',
  },
  runButtonDisabled: {
    opacity: 0.62,
  },
  runButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  statusText: {
    marginTop: 10,
    color: '#1f2937',
    fontSize: 13,
    lineHeight: 19,
  },
  resultsPanel: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 24,
    padding: 14,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
  },
  actualBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#eef2ff',
  },
  sectionLabel: {
    marginTop: 14,
    color: '#312e81',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  emptyText: {
    marginTop: 8,
    color: '#6b7280',
    fontSize: 13,
  },
  resultRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#d1d5db',
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  resultName: {
    flex: 1,
    color: '#111827',
    fontSize: 15,
    fontWeight: '800',
  },
  resultDelta: {
    color: '#0f766e',
    fontSize: 13,
    fontWeight: '800',
  },
  resultShape: {
    marginTop: 5,
    color: '#64748b',
    fontSize: 12,
    lineHeight: 17,
  },
  metricGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  metric: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  metricLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  metricValue: {
    marginTop: 4,
    color: '#111827',
    fontSize: 13,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
});

export default App;
