# BrainBench v1 — 2026-04-18

**Branch:** garrytan/link-timeline-extract
**Commit:** `452c7eb`
**Engine:** PGLite (in-memory)

## Summary

7 categories run. 7 passed, 0 failed.

| # | Category | Status | Script |
|---|----------|--------|--------|
| 1 | Search Quality | ✓ pass | `test/benchmark-search-quality.ts` |
| 2 | Graph Quality | ✓ pass | `test/benchmark-graph-quality.ts` |
| 3 | Identity Resolution | ✓ pass | `eval/runner/identity.ts` |
| 4 | Temporal Queries | ✓ pass | `eval/runner/temporal.ts` |
| 7 | Performance / Latency | ✓ pass | `eval/runner/perf.ts` |
| 10 | Robustness / Adversarial | ✓ pass | `eval/runner/adversarial.ts` |
| 12 | MCP Operation Contract | ✓ pass | `eval/runner/mcp-contract.ts` |

## What this benchmark proves

BrainBench v1 evaluates gbrain across 7 capability domains. Each category is
reproducible (in-memory PGLite, no API keys, no network), runs in CI, and either
passes a quantitative threshold or surfaces a documented gap as future work.

Categories not yet covered (deferred to BrainBench v1.1, see TODOS.md):
- Category 5: Source Attribution / Provenance
- Category 6: Auto-link Precision under Prose (at scale)
- Category 8: Skill Behavior Compliance (needs LLM agent loop)
- Category 9: End-to-End Workflows (needs LLM agent loop)
- Category 11: Multi-modal Ingestion

---
# Category 1: Search Quality

Status: ✓ PASS (exit 0)

```
  Migration 2 applied: slugify_existing_pages
  Migration 3 applied: unique_chunk_index
  Migration 4 applied: access_tokens_and_mcp_log
  Migration 5 applied: multi_type_links_constraint
  Migration 6 applied: timeline_dedup_index
  Migration 7 applied: drop_timeline_search_trigger
Seeded 29 pages, 58 chunks
Running 20 queries x 3 configurations...

# Search Quality Benchmark: 2026-04-18

## Overview

- **29 pages** (10 people, 10 companies, 9 concepts)
- **58 chunks** with overlapping semantic embeddings
- **20 queries** with graded relevance (1-3 grades, multiple relevant pages)
- **3 configurations:** baseline, boost only, boost + intent classifier

All data is fictional. No private information. Embeddings use shared topic dimensions
to simulate real semantic overlap (e.g., "AI" appears in health, education, design, robotics).

Inspired by [Ramp Labs' "Latent Briefing" paper](https://ramp.com) (April 2026).

## Page-Level Retrieval (Traditional IR)

*"Did we find the right page?"*

| Metric | A. Baseline | B. Boost | C. Intent | B vs A | C vs A |
|--------|-------------|----------|-----------|--------|--------|
| P@1 | 0.947 | 0.895 | 0.947 | -0.053 | +0.000 |
| P@5 | 0.811 | 0.674 | 0.695 | -0.137 | -0.116 |
| Recall@5 | 1.404 | 1.170 | 1.201 | -0.234 | -0.204 |
| MRR | 0.974 | 0.939 | 0.974 | -0.035 | +0.000 |
| nDCG@5 | 1.191 | 1.028 | 1.069 | -0.163 | -0.122 |

## Chunk-Level Quality (What PR#64 Actually Improves)

*"Did we find the right CHUNK from the right page?"*

| Metric | A. Baseline | B. Boost | C. Intent | B vs A | C vs A |
|--------|-------------|----------|-----------|--------|--------|
| Source accuracy (top chunk = expected type) | 89.5% | 63.2% | 89.5% | -0.263 | +0.000 |
| CT-first rate (entity Qs: CT chunk leads per page) | 100.0% | 100.0% | 100.0% | +0.000 | +0.000 |
| Timeline accessible (temporal Qs: TL in results) | 100.0% | 71.4% | 100.0% | -0.286 | +0.000 |
| CT guarantee (every page has a CT chunk) | 73.7% | 78.9% | 73.7% | +0.053 | +0.000 |
| Avg chunks per page in results | 1.44 | 1.18 | 1.17 | -0.259 | -0.269 |
| Avg unique pages in top-10 | 7.2 | 8.6 | 8.7 | +1.421 | +1.526 |
| Compiled truth ratio in results | 51.6% | 76.8% | 66.8% | +0.253 | +0.153 |

## Per-Query Detail

| # | Query | Type | Detail | P@1 B/C | Src B→C | CT 1st B/C | Pages B/C |
|---|-------|------|--------|---------|---------|------------|-----------|
| q01 | Person lookup: Alice Chen | comp | low | 1/1 | comp→comp (comp) | 100.0%/100.0% | 7/10 |
| q02 | Company lookup: MindBridge | comp | low | 1/1 | comp→comp (comp) | 100.0%/100.0% | 6/10 |
| q03 | Topic overview: climate investing | comp | low | 1/1 | comp→comp (comp) | 100.0%/100.0% | 5/10 |
| q04 | Temporal: last meeting with Alice | time | hig | 0/0 | time→time (time) | n/a/n/a | 9/9 |
| q05 | Temporal: GenomeAI updates | time | hig | 1/1 | time→time (time) | n/a/n/a | 8/8 |
| q06 | Event: CloudScale acquisition | time | hig | 1/1 | time→time (time) | n/a/n/a | 8/8 |
| q07 | Cross-entity: Alice + NovaPay | comp | med | 1/1 | comp→comp (comp) | 100.0%/100.0% | 7/8 |
| q08 | Cross-entity: Carol + MindBridge | comp | med | 1/1 | comp→comp (comp) | 100.0%/100.0% | 6/8 |
| q09 | Thematic: AI companies | comp | med | 1/1 | comp→comp (comp) | 100.0%/100.0% | 9/10 |
| q10 | Temporal: recent funding rounds | time | hig | 1/1 | time→time (time) | n/a/n/a | 10/10 |
| q11 | Disambiguation: two climate investors | comp | med | 1/1 | comp→comp (comp) | 100.0%/100.0% | 5/9 |
| q12 | Topic: AI and design | comp | med | 1/1 | comp→comp (comp) | 100.0%/100.0% | 7/8 |
| q13 | Full context: RoboLogic | time | hig | 1/1 | comp→comp (time) | n/a/n/a | 6/6 |
| q14 | Full context: crypto custody | time | hig | 1/1 | comp→comp (time) | n/a/n/a | 6/6 |
| q15 | Topic: edtech in Africa | comp | med | 1/1 | comp→comp (comp) | 100.0%/100.0% | 7/10 |
| q16 | Temporal: 2024 launches | time | hig | 1/1 | time→time (time) | n/a/n/a | 10/10 |
| q17 | Expert: MPC wallets | comp | med | 1/1 | comp→comp (comp) | 100.0%/100.0% | 7/9 |
| q18 | Expert: protein folding AI | comp | med | 1/1 | comp→comp (comp) | 100.0%/100.0% | 7/9 |
| q20 | Ambiguous: EduStack in Nigeria | comp | med | 1/1 | comp→comp (comp) | 100.0%/100.0% | 7/8 |

## Analysis

### Improvements (C vs A)
- Unique pages: 7.2 → 8.7

### Boost-Only Damage Report (B vs A)

The boost without the intent classifier causes these regressions:

- Source accuracy drops: 89.5% → 63.2% (-26.3pp)
- Timeline accessibility drops: 100.0% → 71.4%
- P@1 drops: 0.947 → 0.895

The intent classifier recovers all of these by routing temporal/event queries to detail=high (no boost).

## Methodology

- **Engine:** PGLite (in-memory Postgres 17.5 via WASM)
- **Embeddings:** Normalized topic vectors with shared dimensions (25 topic axes)
- **Overlap:** Multiple pages share topics (e.g., 5 pages relevant for "AI companies")
- **Graded relevance:** 1-3 grades per query (3 = primary, 1 = tangentially relevant)

### Metrics explained

**Page-level (traditional IR):** P@k, Recall@k, MRR, nDCG@5 measure "did we find the right page?"

**Chunk-level (what matters for brain search):**
- **Source accuracy:** Is the very first chunk the right TYPE for this query? Entity lookup → compiled truth. Temporal query → timeline.
- **CT-first rate:** For entity queries, is compiled truth the FIRST chunk shown per page? (Not buried below timeline noise.)
- **Timeline accessible:** For temporal queries, do timeline chunks actually appear in results? (Not filtered out by the boost.)
- **CT guarantee:** Does every page in results have at least one compiled truth chunk? (Source-aware dedup.)
- **Chunks/page:** How many chunks per page appear? More = richer context for the agent.
- **Unique pages:** How many distinct pages in top-10? More = broader coverage.

### Configurations
- A. **Baseline:** RRF K=60, no normalization, no boost, text-prefix dedup key
- B. **Boost only:** RRF normalized to 0-1, 2.0x compiled_truth boost, chunk_id dedup key, source-aware dedup
- C. **Boost + Intent:** B + heuristic intent classifier auto-selects detail level. Entity queries get detail=low (CT only). Temporal/event queries get detail=high (no boost, natural ranking). General queries get default medium.

Written to docs/benchmarks/2026-04-18.md

```

---
# Category 2: Graph Quality

Status: ✓ PASS (exit 0)

```
# Graph Quality Benchmark — v0.10.1
Generated: 2026-04-18T03:50:09

## Data
- 80 pages seeded
  Migration 2 applied: slugify_existing_pages
  Migration 3 applied: unique_chunk_index
  Migration 4 applied: access_tokens_and_mcp_log
  Migration 5 applied: multi_type_links_constraint
  Migration 6 applied: timeline_dedup_index
  Migration 7 applied: drop_timeline_search_trigger
- 80 pages in DB
Links: created 95 from 80 pages (db source)

Done: 95 links, 0 timeline entries from 80 pages
Timeline: created 95 entries from 80 pages (db source)

Done: 0 links, 95 timeline entries from 80 pages
- 95 links extracted
- 95 timeline entries extracted

Links: created 95 from 80 pages (db source)

Done: 95 links, 0 timeline entries from 80 pages
Timeline: created 95 entries from 80 pages (db source)

Done: 0 links, 95 timeline entries from 80 pages
## Metrics
| Metric                | Value | Target | Pass |
|-----------------------|-------|--------|------|
| link_recall           | 94.4% | >90.0% | ✓ |
| link_precision        | 100.0% | >95.0% | ✓ |
| timeline_recall       | 100.0% | >85.0% | ✓ |
| timeline_precision    | 100.0% | >95.0% | ✓ |
| type_accuracy         | 94.4% | >80.0% | ✓ |
| relational_recall     | 100.0% | >80.0% | ✓ |
| relational_precision  | 100.0% | >80.0% | ✓ |
| idempotent_links      | true | true   | ✓ |
| idempotent_timeline   | true | true   | ✓ |

## Type confusion matrix (predicted -> { actual: count })
  works_at:  {"works_at":20}
  advises:  {"advises":10}
  invested_in:  {"invested_in":5}
  mentions:  {"invested_in":5,"mentions":15}
  attended:  {"attended":35}

## Configuration A (no graph) vs C (full graph)
Same data, same queries. A = pre-v0.10.3 brain (no extract, fallback to
content scanning). C = full graph layer (typed traversal).

| Metric                 | A: no graph | C: full graph | Delta       |
|------------------------|-------------|----------------|-------------|
| relational_recall      | 100.0%      | 100.0%         | +0%         |
| relational_precision   | 58.8%       | 100.0%         | +70%        |

## Per-query: A vs C
Found = correct hits. Returned = total results (correct + noise).
Lower returned-count at same found-count means less noise to filter.

| Question                                 | Expected | A: found / returned | C: found / returned |
|------------------------------------------|----------|---------------------|---------------------|
| Who attended Demo Day 0?                 | 3        | 3 / 3               | 3 / 3               |
| Who attended Board 0?                    | 2        | 2 / 2               | 2 / 2               |
| What companies has uma-advisor advised?  | 2        | 2 / 2               | 2 / 2               |
| Who works at startup-0?                  | 2        | 2 / 5               | 2 / 2               |
| Which VCs invested in startup-0?         | 1        | 1 / 5               | 1 / 1               |

## Multi-hop traversal (depth 2)
Single-pass naive grep can't chain. C does it in one recursive CTE.

| Question                                 | Expected | A: found / returned | C: found / returned |
|------------------------------------------|----------|---------------------|---------------------|
| Who attended meetings with frank-founder | 3        | 0 / 1               | 3 / 3               |
| Who attended meetings with grace-founder | 5        | 0 / 1               | 5 / 5               |
| Who attended meetings with alice-partner | 2        | 0 / 0               | 2 / 2               |
Multi-hop recall: A vs C — 0 vs 10 of 10 expected. C aggregate: recall 100.0%, precision 100.0%.

## Aggregate queries
"Top N most-connected" — A counts text mentions, C counts dedupe'd structured links.

**Top 4 most-connected people (by inbound attended links)**
- Expected (any order): `people/grace-founder`, `people/henry-founder`, `people/iris-founder`, `people/jack-founder`
- A (text-mention count): `people/grace-founder`, `people/henry-founder`, `people/iris-founder`, `people/jack-founder` → ✓ matches
- C (structured backlinks): `people/grace-founder`, `people/henry-founder`, `people/iris-founder`, `people/jack-founder` → ✓ matches

## Type-disagreement queries (set intersection on inbound link types)
A must scan prose for verb patterns; C does two filtered getLinks + intersect.

**Startups with both VC investment AND advisor coverage**
- Expected: 5 startups (startup-0, startup-1, startup-2, startup-3, startup-4)
- A: 8 returned (startup-0, startup-1, startup-2, startup-3, startup-4, startup-5, startup-6, startup-7). Recall 100.0%, precision 62.5%.
- C: 5 returned (startup-0, startup-1, startup-2, startup-3, startup-4). Recall 100.0%, precision 100.0%.

## Search ranking with backlink boost
Keyword query that matches both well-connected and unconnected pages. Compare
average rank (lower = better) of each group before vs after applying the backlink
boost (`score *= 1 + 0.05 * log(1 + n)`).

**Keyword search for "company" — average rank of well-connected vs unconnected pages, before and after backlink boost**
| Group                                    | Avg rank without boost | Avg rank with boost | Δ |
|------------------------------------------|------------------------|---------------------|---|
| Well-connected (4 inbound links each)    | 3.5                    | 2.5                 | +1.0 ↑ better |
| Unconnected (0 inbound links each)       | 8.5                    | 8.5                 | +0.0  |


✓ All thresholds passed.

```

---
# Category 3: Identity Resolution

Status: ✓ PASS (exit 0)

```
# BrainBench Category 3: Identity Resolution

Generated: 2026-04-18T03:50:10
Entities: 100
Aliases per entity: 3 documented + 5 undocumented = 8 total
  Migration 2 applied: slugify_existing_pages
  Migration 3 applied: unique_chunk_index
  Migration 4 applied: access_tokens_and_mcp_log
  Migration 5 applied: multi_type_links_constraint
  Migration 6 applied: timeline_dedup_index
  Migration 7 applied: drop_timeline_search_trigger

## Metrics
| Alias category   | Recall (top-10) | MRR    |
|------------------|-----------------|--------|
| Documented       | 100.0%             | 0.992  |
| Undocumented     | 31.0%             | 0.277  |

## Per-alias-type breakdown (documented)
  fullname   100/100 = 100.0%
  handle     100/100 = 100.0%
  email      100/100 = 100.0%

## Per-alias-type breakdown (undocumented)
  initial       15/100 = 15.0%
  no-period     15/100 = 15.0%
  typo          25/200 = 12.5%
  handle-plain  100/100 = 100.0%

## Interpretation
Documented aliases (full name, handle, email mentioned in canonical body):
  Recall 100.0% — what current gbrain can do via tsvector keyword match.
Undocumented aliases (initials, typos, handle without @):
  Recall 31.0% — what current gbrain CAN'T do without an alias table.

Gap: gbrain has no alias table, no fuzzy match, no nickname dictionary.
Suggested v0.11 feature: explicit aliases + Levenshtein/phonetic match.

```

---
# Category 4: Temporal Queries

Status: ✓ PASS (exit 0)

```
# BrainBench Category 4: Temporal Queries

Generated: 2026-04-18T03:50:11
Events: 725
Entities: 50
As-of queries: 50
  Migration 2 applied: slugify_existing_pages
  Migration 3 applied: unique_chunk_index
  Migration 4 applied: access_tokens_and_mcp_log
  Migration 5 applied: multi_type_links_constraint
  Migration 6 applied: timeline_dedup_index
  Migration 7 applied: drop_timeline_search_trigger

## Point queries
  30 dates queried, 66 expected events
  Recall: 100.0%, Precision: 100.0%

## Range queries
  Q1 2024: 37 expected, 37 returned, R=100.0%, P=100.0%
  Q2 2025: 33 expected, 33 returned, R=100.0%, P=100.0%
  2026 full year: 0 expected, 0 returned, R=100.0%, P=100.0%
  Q3 2023: 45 expected, 45 returned, R=100.0%, P=100.0%
  Average: R=100.0%, P=100.0%

## Recency queries (most recent 3 events per entity)
  30 entities × 3 most-recent events each
  Top-3 correctness: 100.0%

## As-of queries (HARD — no native gbrain operation)
  Approach: read full timeline, filter events ≤ asOfDate, take most-recent matching entry.
  50 as-of queries, 50 correct = 100.0%
  Note: requires manual filter+sort logic per query. A native `getStateAtTime`
  operation would make this trivial. Suggested v0.11 feature.

## Summary
| Sub-category    | Recall | Precision | Notes                                |
|-----------------|--------|-----------|--------------------------------------|
| Point           | 100.0% | 100.0%    | Cross-entity date query (manual)     |
| Range           | 100.0% | 100.0%    | Same — manual cross-entity filter    |
| Recency (top-3) | 100.0% | —         | Per-entity, native getTimeline       |
| As-of           | 100.0% | —         | Hard, no native op (filter+sort)     |

```

---
# Category 7: Performance / Latency

Status: ✓ PASS (exit 0)

```
# BrainBench Category 7: Performance / Latency

Generated: 2026-04-18T03:50:13
Engine: PGLite (in-memory)

## Scale: 1000 pages

  Migration 2 applied: slugify_existing_pages
  Migration 3 applied: unique_chunk_index
  Migration 4 applied: access_tokens_and_mcp_log
  Migration 5 applied: multi_type_links_constraint
  Migration 6 applied: timeline_dedup_index
  Migration 7 applied: drop_timeline_search_trigger
Bulk putPage: 1000 pages in 0.2s = 4775.4 pages/sec
Bulk addLink: 2850 links in 0.4s = 7702.1 links/sec
  get_page               P50=0.09ms  P95=0.18ms  P99=0.31ms  (n=50)
  get_links              P50=0.15ms  P95=0.38ms  P99=1.01ms  (n=50)
  get_backlinks          P50=0.16ms  P95=0.35ms  P99=0.36ms  (n=50)
  get_backlinks_hub      P50=0.34ms  P95=0.51ms  P99=0.51ms  (n=20)
  get_timeline           P50=0.12ms  P95=0.33ms  P99=0.35ms  (n=50)
  get_stats              P50=0.87ms  P95=2.76ms  P99=2.76ms  (n=10)
  list_pages_50          P50=0.53ms  P95=1.00ms  P99=1.00ms  (n=20)
  search_keyword         P50=0.18ms  P95=0.57ms  P99=0.86ms  (n=30)
  traverse_paths_d1      P50=1.43ms  P95=2.54ms  P99=2.54ms  (n=10)
  traverse_paths_d2      P50=10.05ms  P95=12.67ms  P99=12.67ms  (n=10)
  putPage_single         P50=0.13ms  P95=0.39ms  P99=0.48ms  (n=30)

## Scale: 10000 pages

  Migration 2 applied: slugify_existing_pages
  Migration 3 applied: unique_chunk_index
  Migration 4 applied: access_tokens_and_mcp_log
  Migration 5 applied: multi_type_links_constraint
  Migration 6 applied: timeline_dedup_index
  Migration 7 applied: drop_timeline_search_trigger
Bulk putPage: 10000 pages in 1.6s = 6344.0 pages/sec
Bulk addLink: 28500 links in 3.3s = 8688.8 links/sec
  get_page               P50=0.08ms  P95=0.10ms  P99=0.14ms  (n=50)
  get_links              P50=0.13ms  P95=0.24ms  P99=0.58ms  (n=50)
  get_backlinks          P50=0.14ms  P95=0.34ms  P99=0.57ms  (n=50)
  get_backlinks_hub      P50=0.29ms  P95=0.32ms  P99=0.32ms  (n=20)
  get_timeline           P50=0.11ms  P95=0.30ms  P99=0.34ms  (n=50)
  get_stats              P50=3.60ms  P95=7.26ms  P99=7.26ms  (n=10)
  list_pages_50          P50=1.58ms  P95=2.54ms  P99=2.54ms  (n=20)
  search_keyword         P50=0.19ms  P95=0.54ms  P99=0.63ms  (n=30)
  traverse_paths_d1      P50=2.08ms  P95=3.63ms  P99=3.63ms  (n=10)
  traverse_paths_d2      P50=91.07ms  P95=92.09ms  P99=92.09ms  (n=10)
  putPage_single         P50=0.13ms  P95=0.28ms  P99=0.54ms  (n=30)

```

---
# Category 10: Robustness / Adversarial

Status: ✓ PASS (exit 0)

```
# BrainBench Category 10: Robustness / Adversarial

Generated: 2026-04-18T03:50:21
  Migration 2 applied: slugify_existing_pages
  Migration 3 applied: unique_chunk_index
  Migration 4 applied: access_tokens_and_mcp_log
  Migration 5 applied: multi_type_links_constraint
  Migration 6 applied: timeline_dedup_index
  Migration 7 applied: drop_timeline_search_trigger

## Case: empty compiled_truth
  6/6 ops succeeded

## Case: whitespace only
  6/6 ops succeeded

## Case: newlines only
  6/6 ops succeeded

## Case: 50K char page
  6/6 ops succeeded

## Case: 100K char page
  6/6 ops succeeded

## Case: CJK content
  6/6 ops succeeded

## Case: Arabic RTL
  6/6 ops succeeded

## Case: Cyrillic
  6/6 ops succeeded

## Case: emoji-heavy
  6/6 ops succeeded

## Case: mixed scripts
  6/6 ops succeeded

## Case: slug inside code fence
  6/6 ops succeeded

## Case: inline code with slug
  6/6 ops succeeded

## Case: false-positive substring
  6/6 ops succeeded

## Case: slug with dots
  6/6 ops succeeded

## Case: slug with leading number
  6/6 ops succeeded

## Case: slug max length
  6/6 ops succeeded

## Case: invalid date in timeline
  6/6 ops succeeded

## Case: timeline with no dates
  6/6 ops succeeded

## Case: deeply nested lists
  6/6 ops succeeded

## Case: long blockquote chain
  6/6 ops succeeded

## Case: 100 refs in one page
  6/6 ops succeeded

## Case: same entity 50 times
  7/7 ops succeeded

## Summary
Cases: 22
Ops attempted: 133
Ops succeeded: 133 (100.0%)
Crashes: 0
Silent corruption: 0

```

---
# Category 12: MCP Operation Contract

Status: ✓ PASS (exit 0)

```
# BrainBench Category 12: MCP Operation Contract

Generated: 2026-04-18T03:50:52
Operations available: 30
  Migration 2 applied: slugify_existing_pages
  Migration 3 applied: unique_chunk_index
  Migration 4 applied: access_tokens_and_mcp_log
  Migration 5 applied: multi_type_links_constraint
  Migration 6 applied: timeline_dedup_index
  Migration 7 applied: drop_timeline_search_trigger

## Trust boundary: traverse_graph depth cap
  ✓ traverse_graph depth=1000 from remote should be capped or rejected
  ✓ traverse_graph depth=5 from remote should succeed (under cap)

## Trust boundary: list_pages limit cap
  ✓ returned 10 pages

## Input validation: slug format
  ✓ path traversal: rejected
  ✓ absolute path: rejected
  ✓ parent escape: rejected
  ✓ missing directory prefix: rejected
  ✓ empty string: rejected
  ✓ huge slug (10K chars): rejected

## Input validation: date format
  ✓ "not-a-date": rejected
  ✓ "2026-13-45": rejected
  ✓ "99999-01-01": rejected
  ✓ "": rejected
  ✓ "../../../etc/passwd": rejected

## Injection: SQL injection attempts
  ✓ "'; DROP TABLE pages; --": safe
  ✓ "' OR '1'='1": safe
  ✓ "'; SELECT * FROM access_tokens": safe
  ✓ "\x00\x00\x00": safe
  ✓ " injection": invalid byte sequence for encoding "UTF8": 0x00

## Resource exhaustion: large inputs
  ✓ 10MB query: 395ms

## Sanity: every operation has a handler
  30/30 operations have handlers

## Summary
Tests: 50
Passed: 50 (100.0%)
Failed: 0

```

---
## How to reproduce

```bash
bun run eval/runner/all.ts
```

Each category can also run individually:
```bash
bun test/benchmark-search-quality.ts
bun test/benchmark-graph-quality.ts
bun eval/runner/identity.ts
bun eval/runner/temporal.ts
bun eval/runner/perf.ts
bun eval/runner/adversarial.ts
bun eval/runner/mcp-contract.ts
```

No API keys required. All runs against PGLite in-memory. Total runtime ~3 min.