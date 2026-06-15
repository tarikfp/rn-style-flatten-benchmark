/**
 * @format
 */

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Image,
  ImageBackground,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';

type Sample = {
  id: number;
  durationMs: number;
};

const COUNTS = [25, 50, 100, 200];
const SAMPLE_COUNT = 15;
const PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';

function now(): number {
  return global.performance?.now?.() ?? Date.now();
}

function round(value: number): string {
  return value.toFixed(2);
}

function median(values: Array<number>): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[middle];
  }

  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function average(values: Array<number>): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getStats(samples: Array<Sample>) {
  const values = samples.map(sample => sample.durationMs);

  return {
    median: median(values),
    average: average(values),
    min: values.length > 0 ? Math.min(...values) : 0,
    max: values.length > 0 ? Math.max(...values) : 0,
  };
}

function BenchmarkPayload({
  enabled,
  itemCount,
  onCommit,
}: {
  enabled: boolean;
  itemCount: number;
  onCommit: (durationMs: number) => void;
}) {
  const startedAt = useRef(now());
  const rows = useMemo(
    () => Array.from({length: itemCount}, (_, index) => index),
    [itemCount],
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      onCommit(now() - startedAt.current);
    });

    return () => cancelAnimationFrame(frame);
  }, [enabled, onCommit]);

  return (
    <ScrollView
      style={[styles.workbench, [styles.workbenchInset, null]]}
      contentContainerStyle={[styles.workbenchContent, false]}>
      {rows.map(index => {
        const toneStyle = index % 2 === 0 ? styles.toneA : styles.toneB;
        const nestedChrome = [
          styles.row,
          [styles.rowChrome, toneStyle],
          index % 3 === 0 && styles.rowRaised,
          {borderLeftWidth: (index % 4) + 1},
        ];
        const nestedText = [
          styles.rowTitle,
          [index % 2 === 0 && styles.rowTitleWarm],
          [{opacity: index % 5 === 0 ? 0.82 : 1}],
        ];
        const nestedMeta = [
          styles.rowMeta,
          null,
          [index % 3 === 0 ? styles.rowMetaStrong : false],
        ];
        const controlStyle = [
          styles.control,
          [styles.controlBorder, index % 2 === 1 && styles.controlAlt],
        ];

        return (
          <View key={index} style={nestedChrome}>
            <Image
              source={{uri: PIXEL}}
              style={[
                styles.avatar,
                [index % 2 === 0 && styles.avatarBlue],
                {transform: [{scale: index % 7 === 0 ? 1.03 : 1}]},
              ]}
            />
            <View style={[styles.rowBody, [styles.rowBodyInner]]}>
              <Text style={nestedText}>Style-heavy row {index + 1}</Text>
              <Text style={nestedMeta}>
                Text, Image, ImageBackground, TextInput, TouchableOpacity and
                ScrollView all receive nested style arrays.
              </Text>
              <ImageBackground
                source={{uri: PIXEL}}
                resizeMode="stretch"
                style={[
                  styles.imageBand,
                  [index % 2 === 0 ? styles.imageBandCool : styles.imageBandHot],
                ]}
                imageStyle={[styles.imageBandImage, null]}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={[styles.inlineScroll, [styles.inlineScrollBorder]]}
                  contentContainerStyle={[styles.inlineScrollContent]}>
                  <TextInput
                    value={`nested-${index}`}
                    editable={false}
                    style={controlStyle}
                  />
                  <TouchableOpacity
                    activeOpacity={0.75}
                    style={[
                      styles.action,
                      [index % 2 === 0 && styles.actionPrimary],
                      false,
                    ]}>
                    <Text style={[styles.actionText, [styles.actionTextNested]]}>
                      touchable
                    </Text>
                  </TouchableOpacity>
                </ScrollView>
              </ImageBackground>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';
  const [itemCount, setItemCount] = useState(100);
  const [runId, setRunId] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [samples, setSamples] = useState<Array<Sample>>([]);
  const samplesRef = useRef<Array<Sample>>([]);
  const nextRunTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stats = getStats(samples);

  useEffect(() => {
    return () => {
      if (nextRunTimerRef.current != null) {
        clearTimeout(nextRunTimerRef.current);
      }
    };
  }, []);

  const handleCommit = useCallback(
    (durationMs: number) => {
      if (!isRunning) {
        return;
      }

      const nextSamples = [
        ...samplesRef.current,
        {id: samplesRef.current.length + 1, durationMs},
      ];
      samplesRef.current = nextSamples;
      setSamples(nextSamples);

      if (nextSamples.length < SAMPLE_COUNT) {
        if (nextRunTimerRef.current != null) {
          clearTimeout(nextRunTimerRef.current);
        }
        nextRunTimerRef.current = setTimeout(() => {
          nextRunTimerRef.current = null;
          setRunId(value => value + 1);
        }, 64);
      } else {
        setIsRunning(false);
      }
    },
    [isRunning],
  );

  const start = useCallback(() => {
    if (nextRunTimerRef.current != null) {
      clearTimeout(nextRunTimerRef.current);
      nextRunTimerRef.current = null;
    }
    samplesRef.current = [];
    setSamples([]);
    setIsRunning(true);
    setRunId(value => value + 1);
  }, []);

  return (
    <View style={styles.screen}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        <Text style={styles.title}>Style Flattening Benchmark</Text>
        <Text style={styles.subtitle}>
          Remounts a pure React Native screen with nested style arrays across
          core components.
        </Text>
      </View>

      <View style={styles.controls}>
        {COUNTS.map(count => (
          <TouchableOpacity
            key={count}
            activeOpacity={0.75}
            onPress={() => setItemCount(count)}
            style={[
              styles.countButton,
              itemCount === count && styles.countButtonActive,
            ]}>
            <Text
              style={[
                styles.countButtonText,
                itemCount === count && styles.countButtonTextActive,
              ]}>
              {count}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          activeOpacity={0.75}
          disabled={isRunning}
          onPress={start}
          style={[styles.runButton, isRunning && styles.runButtonDisabled]}>
          <Text style={styles.runButtonText}>
            {isRunning ? `Running ${samples.length}/${SAMPLE_COUNT}` : 'Run'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.stats}>
        <Text style={styles.stat}>median {round(stats.median)} ms</Text>
        <Text style={styles.stat}>avg {round(stats.average)} ms</Text>
        <Text style={styles.stat}>min {round(stats.min)} ms</Text>
        <Text style={styles.stat}>max {round(stats.max)} ms</Text>
      </View>

      <BenchmarkPayload
        key={`${itemCount}-${runId}`}
        enabled={isRunning}
        itemCount={itemCount}
        onCommit={handleCommit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f6f7f9',
  },
  header: {
    paddingTop: 58,
    paddingHorizontal: 18,
    paddingBottom: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#c9ced6',
  },
  title: {
    color: '#111827',
    fontSize: 27,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 6,
    color: '#4b5563',
    fontSize: 14,
    lineHeight: 20,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
  },
  countButton: {
    minWidth: 48,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#b8c0cc',
    backgroundColor: '#ffffff',
  },
  countButtonActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  countButtonText: {
    color: '#374151',
    fontWeight: '700',
  },
  countButtonTextActive: {
    color: '#ffffff',
  },
  runButton: {
    marginLeft: 'auto',
    height: 36,
    minWidth: 98,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#0f766e',
  },
  runButtonDisabled: {
    opacity: 0.58,
  },
  runButtonText: {
    color: '#ffffff',
    fontWeight: '800',
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 10,
    backgroundColor: '#ffffff',
  },
  stat: {
    color: '#1f2937',
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  workbench: {
    flex: 1,
  },
  workbenchInset: {
    backgroundColor: '#eef2f7',
  },
  workbenchContent: {
    padding: 12,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#cad1dc',
  },
  rowChrome: {
    backgroundColor: '#ffffff',
  },
  toneA: {
    borderLeftColor: '#2563eb',
  },
  toneB: {
    borderLeftColor: '#d97706',
  },
  rowRaised: {
    shadowColor: '#111827',
    shadowOpacity: 0.09,
    shadowRadius: 8,
    shadowOffset: {width: 0, height: 4},
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 8,
    backgroundColor: '#f97316',
  },
  avatarBlue: {
    backgroundColor: '#2563eb',
  },
  rowBody: {
    flex: 1,
    marginLeft: 10,
  },
  rowBodyInner: {
    minHeight: 86,
  },
  rowTitle: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '800',
  },
  rowTitleWarm: {
    color: '#7c2d12',
  },
  rowMeta: {
    marginTop: 3,
    color: '#4b5563',
    fontSize: 12,
    lineHeight: 17,
  },
  rowMetaStrong: {
    color: '#0f766e',
  },
  imageBand: {
    marginTop: 9,
    minHeight: 46,
    justifyContent: 'center',
    borderRadius: 8,
    overflow: 'hidden',
  },
  imageBandCool: {
    backgroundColor: '#dbeafe',
  },
  imageBandHot: {
    backgroundColor: '#ffedd5',
  },
  imageBandImage: {
    opacity: 0.06,
  },
  inlineScroll: {
    flexGrow: 0,
  },
  inlineScrollBorder: {
    borderRadius: 7,
  },
  inlineScrollContent: {
    alignItems: 'center',
    gap: 8,
    padding: 6,
  },
  control: {
    width: 112,
    height: 32,
    paddingHorizontal: 8,
    borderRadius: 7,
    color: '#111827',
    backgroundColor: '#ffffff',
  },
  controlBorder: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#9ca3af',
  },
  controlAlt: {
    backgroundColor: '#f8fafc',
  },
  action: {
    height: 32,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 7,
    backgroundColor: '#374151',
  },
  actionPrimary: {
    backgroundColor: '#0f766e',
  },
  actionText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 12,
  },
  actionTextNested: {
    letterSpacing: 0,
  },
});

export default App;
