import type { EventEmitter } from 'node:events';

export interface QueryMetrics {
  /**
   * Logical queries issued by the code: driver commands excluding cursor
   * continuation traffic. This is the metric that catches N+1 patterns and
   * duplicated reads, and it is an exact integer — the property the performance
   * layer asserts on.
   */
  queries: number;
  /** Every driver command, including `getMore` and `killCursors`. */
  roundTrips: number;
  /**
   * Documents materialized into Node memory (sum of `reply.nReturned`).
   * Sums correctly across cursor batches, so it reflects transfer volume and
   * is what surfaces a missing `select()` or `limit()`.
   */
  docsReturned: number;
}

/** Cursor traffic: real round trips, but not additional queries. */
const CURSOR_COMMANDS = new Set(['getMore', 'killCursors']);

/**
 * Counts MongoDB driver commands around a measured window.
 *
 * Reads `commandStarted` / `commandSucceeded` from the driver rather than
 * instrumenting Mongoose, so the numbers describe what actually reached the
 * server and are independent of Mongoose internals or query-helper chaining.
 */
export class QueryMetricsCollector {
  private readonly onCommandStarted: (event: { commandName?: string }) => void;
  private readonly onCommandSucceeded: (event: {
    reply?: Record<string, unknown>;
  }) => void;
  private collecting = false;
  private queries = 0;
  private roundTrips = 0;
  private docsReturned = 0;

  constructor(private readonly client: EventEmitter) {
    this.onCommandStarted = (event) => {
      if (!this.collecting || !event?.commandName) return;
      this.roundTrips += 1;
      if (!CURSOR_COMMANDS.has(event.commandName)) this.queries += 1;
    };

    this.onCommandSucceeded = (event: {
      commandName?: string;
      reply?: Record<string, unknown>;
    }) => {
      if (!this.collecting || !event?.commandName) return;
      const reply = event.reply as Record<string, any> | undefined;
      let nReturned: number | undefined;
      if (reply && typeof reply.nReturned === 'number') {
        nReturned = reply.nReturned;
      }
      if (
        nReturned === undefined &&
        reply &&
        reply.cursor &&
        Array.isArray(reply.cursor.firstBatch)
      ) {
        nReturned = reply.cursor.firstBatch.length;
      }
      if (typeof nReturned === 'number' && Number.isFinite(nReturned)) {
        this.docsReturned += nReturned;
      }
    };
  }

  /**
   * Begins counting and attaches the listeners. Events before this call are
   * ignored. Idempotent, so a collector can be reused across measured windows.
   */
  start(): void {
    this.detach();
    this.queries = 0;
    this.roundTrips = 0;
    this.docsReturned = 0;
    this.collecting = true;
    this.attach();
  }

  /** Stops counting, detaches listeners and returns the measured window. */
  stop(): QueryMetrics {
    this.collecting = false;
    this.detach();
    return this.snapshot();
  }

  /** Current values without stopping. Returns a copy. */
  snapshot(): QueryMetrics {
    return {
      queries: this.queries,
      roundTrips: this.roundTrips,
      docsReturned: this.docsReturned,
    };
  }

  /** Re-attaches listeners so the collector can be reused. */
  private attach(): void {
    this.client.on('commandStarted', this.onCommandStarted);
    this.client.on('commandSucceeded', this.onCommandSucceeded);
  }

  private detach(): void {
    this.client.off('commandStarted', this.onCommandStarted);
    this.client.off('commandSucceeded', this.onCommandSucceeded);
  }

  /**
   * Convenience for the common case: run `fn`, return its result alongside the
   * metrics collected while it ran.
   */
  static async measure<T>(
    collector: QueryMetricsCollector,
    fn: () => Promise<T>,
  ): Promise<{ result: T; metrics: QueryMetrics }> {
    collector.start();
    try {
      const result = await fn();
      const metrics = collector.stop();
      return { result, metrics };
    } catch (error) {
      collector.stop();
      throw error;
    }
  }
}
