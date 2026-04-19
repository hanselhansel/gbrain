// ~/gbrain-source/test/e2e/file-watcher.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { createFileWatcher, type FileWatcher } from '../../src/mcp/file-watcher.ts';
import { createEngine } from '../../src/core/engine-factory.ts';
import { importFromFile } from '../../src/core/import-file.ts';
import { basename, relative } from 'path';
import type { BrainEngine } from '../../src/core/engine.ts';

describe('file-watcher', () => {
  let watchDir: string;
  let watcher: FileWatcher | null = null;

  beforeEach(() => {
    watchDir = mkdtempSync(join(tmpdir(), 'gbrain-watcher-test-'));
  });

  afterEach(async () => {
    if (watcher) await watcher.stop();
    rmSync(watchDir, { recursive: true, force: true });
  });

  it('emits change event when a .md file is added', async () => {
    const changes: string[] = [];
    watcher = createFileWatcher({
      dir: watchDir,
      debounceMs: 50,
      onChange: (path) => { changes.push(path); },
    });
    await watcher.start();

    const filePath = join(watchDir, 'hello.md');
    writeFileSync(filePath, '# Hello\n');

    // Wait for debounce + event propagation
    await new Promise((r) => setTimeout(r, 600));

    expect(changes).toContain(filePath);
  });

  it('debounces rapid successive writes into one event', async () => {
    const changes: string[] = [];
    watcher = createFileWatcher({
      dir: watchDir,
      debounceMs: 100,
      onChange: (path) => { changes.push(path); },
    });
    await watcher.start();

    const filePath = join(watchDir, 'rapid.md');
    for (let i = 0; i < 5; i++) {
      writeFileSync(filePath, `content-${i}`);
      await new Promise((r) => setTimeout(r, 10));
    }

    await new Promise((r) => setTimeout(r, 700));

    const rapidEvents = changes.filter((p) => p === filePath);
    expect(rapidEvents.length).toBe(1);
  });

  it('ignores files in excluded directories', async () => {
    const changes: string[] = [];
    watcher = createFileWatcher({
      dir: watchDir,
      debounceMs: 50,
      excludePatterns: ['**/restricted/**', '**/.pending/**', '**/.git/**'],
      onChange: (path) => { changes.push(path); },
    });
    await watcher.start();

    const restrictedDir = join(watchDir, 'restricted');
    mkdirSync(restrictedDir);
    writeFileSync(join(restrictedDir, 'secret.md'), '# secret');

    await new Promise((r) => setTimeout(r, 600));

    expect(changes).toHaveLength(0);
  });

  it('ignores non-markdown files', async () => {
    const changes: string[] = [];
    watcher = createFileWatcher({
      dir: watchDir,
      debounceMs: 50,
      onChange: (path) => { changes.push(path); },
    });
    await watcher.start();

    writeFileSync(join(watchDir, 'notes.txt'), 'not markdown');
    writeFileSync(join(watchDir, 'binary.bin'), 'binary');

    await new Promise((r) => setTimeout(r, 600));

    expect(changes).toHaveLength(0);
  });

  it('stop() waits for in-flight onChange calls to complete', async () => {
    let onChangeStarted = false;
    let onChangeCompleted = false;
    watcher = createFileWatcher({
      dir: watchDir,
      debounceMs: 50,
      onChange: async () => {
        onChangeStarted = true;
        await new Promise((r) => setTimeout(r, 300));
        onChangeCompleted = true;
      },
    });
    await watcher.start();

    const filePath = join(watchDir, 'slow.md');
    writeFileSync(filePath, '# slow\n');

    // Wait for chokidar awaitWriteFinish (~300ms) + debounce (50ms) so
    // the onChange handler has begun, but not long enough to finish its 300ms body.
    const deadline = Date.now() + 2000;
    while (!onChangeStarted && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 25));
    }
    expect(onChangeStarted).toBe(true);
    expect(onChangeCompleted).toBe(false);

    const stopStart = Date.now();
    await watcher.stop();
    const stopDuration = Date.now() - stopStart;
    watcher = null;

    // stop() must NOT resolve before the in-flight onChange finishes.
    expect(onChangeCompleted).toBe(true);
    // Sanity: stop waited at least a little for the remaining work.
    expect(stopDuration).toBeGreaterThanOrEqual(30);
  });
});

describe('file-watcher + engine integration', () => {
  let watchDir: string;
  let dataDir: string;
  let engine: BrainEngine;
  let watcher: FileWatcher | null = null;

  beforeEach(async () => {
    watchDir = mkdtempSync(join(tmpdir(), 'gbrain-watch-integ-'));
    dataDir = mkdtempSync(join(tmpdir(), 'gbrain-data-integ-'));
    engine = await createEngine({ engine: 'pglite', database_path: dataDir });
    await engine.connect({ engine: 'pglite', database_path: dataDir });
    await engine.initSchema();
  });

  afterEach(async () => {
    if (watcher) await watcher.stop();
    await engine.disconnect();
    rmSync(watchDir, { recursive: true, force: true });
    rmSync(dataDir, { recursive: true, force: true });
  });

  it('imports a new markdown file into the engine within 5 seconds', async () => {
    watcher = createFileWatcher({
      dir: watchDir,
      debounceMs: 100,
      onChange: async (path) => {
        const rel = relative(watchDir, path);
        await importFromFile(engine, path, rel, { noEmbed: true });
      },
    });
    await watcher.start();

    const filePath = join(watchDir, 'integ.md');
    writeFileSync(
      filePath,
      `---\ntitle: "Integration Test Page"\ntype: reference\n---\n\n# Integration\n\nThis is a test.\n`
    );

    // Wait for watcher debounce + import (awaitWriteFinish adds ~300ms)
    await new Promise((r) => setTimeout(r, 2000));

    const page = await engine.getPage('integ');
    expect(page).toBeTruthy();
    expect(page?.title).toBe('Integration Test Page');
  });
});
