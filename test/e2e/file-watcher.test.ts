// ~/gbrain-source/test/e2e/file-watcher.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { createFileWatcher, type FileWatcher } from '../../src/mcp/file-watcher.ts';

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
});
