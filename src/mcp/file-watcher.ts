// ~/gbrain-source/src/mcp/file-watcher.ts
import chokidar, { type FSWatcher } from 'chokidar';
import { extname } from 'path';

export interface FileWatcherOptions {
  dir: string;
  debounceMs?: number;
  excludePatterns?: string[];
  onChange: (path: string) => void | Promise<void>;
  onError?: (err: Error, path?: string) => void;
}

export interface FileWatcher {
  start(): Promise<void>;
  stop(): Promise<void>;
}

const DEFAULT_EXCLUDES = [
  '**/restricted/**',
  '**/.pending/**',
  '**/.git/**',
  '**/node_modules/**',
  '**/.gbrain/**',
];

export function createFileWatcher(opts: FileWatcherOptions): FileWatcher {
  const debounceMs = opts.debounceMs ?? 2000;
  const excludes = opts.excludePatterns ?? DEFAULT_EXCLUDES;
  const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const inFlight = new Set<Promise<unknown>>();
  let watcher: FSWatcher | null = null;

  const schedule = (path: string) => {
    // Only react to markdown files
    if (extname(path).toLowerCase() !== '.md') return;

    const existing = debounceTimers.get(path);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      debounceTimers.delete(path);
      const p = Promise.resolve(opts.onChange(path)).catch((err) => {
        if (opts.onError) opts.onError(err as Error, path);
        else console.error(`[file-watcher] onChange failed for ${path}:`, err);
      });
      inFlight.add(p);
      p.finally(() => {
        inFlight.delete(p);
      });
    }, debounceMs);

    debounceTimers.set(path, timer);
  };

  return {
    async start() {
      if (watcher) throw new Error('watcher already started');
      watcher = chokidar.watch(opts.dir, {
        ignored: excludes,
        ignoreInitial: true,
        persistent: true,
        awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 50 },
      });

      watcher.on('add', schedule);
      watcher.on('change', schedule);
      watcher.on('error', (err) => {
        if (opts.onError) opts.onError(err as Error);
        else console.error('[file-watcher] error:', err);
      });

      // Wait for ready so test timing is predictable
      await new Promise<void>((resolve) => watcher!.once('ready', () => resolve()));
    },

    async stop() {
      // Drain pending debounces
      for (const t of debounceTimers.values()) clearTimeout(t);
      debounceTimers.clear();

      // Wait for in-flight onChange calls to settle so we don't disconnect
      // the engine mid-transaction (e.g., SIGINT during reindex).
      if (inFlight.size > 0) {
        await Promise.allSettled(Array.from(inFlight));
      }

      if (watcher) {
        await watcher.close();
        watcher = null;
      }
    },
  };
}
