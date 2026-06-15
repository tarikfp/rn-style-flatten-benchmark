# React Native style flattening benchmark

Baseline: main 066c0d8bd8
Optimized: codex/optimize-style-flatten 81b5bc26b6

| case | baseline median ms | optimized median ms | improvement |
| --- | ---: | ---: | ---: |
| object style | 3.32 | 3.26 | 1.8% |
| single style array | 126.44 | 123.87 | 2.0% |
| single effective style array | 137.06 | 126.59 | 7.6% |
| nested single style array | 295.25 | 98.04 | 66.8% |
| merged style array | 106.06 | 103.11 | 2.8% |
| nested merged style array | 275.93 | 120.98 | 56.2% |
