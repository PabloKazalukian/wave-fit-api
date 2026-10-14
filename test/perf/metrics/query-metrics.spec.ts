import { EventEmitter } from 'node:events';
import { QueryMetricsCollector } from './query-metrics';

interface CommandStartedEvent {
  commandName?: string;
  command?: Record<string, unknown>;
}

interface CommandSucceededEvent {
  commandName?: string;
  reply?: Record<string, unknown>;
}

class FakeClient extends EventEmitter {
  start(name: string, command: Record<string, unknown> = {}) {
    this.emit('commandStarted', {
      commandName: name,
      command,
    } as CommandStartedEvent);
  }

  succeed(name: string, reply: Record<string, unknown> = {}) {
    this.emit('commandSucceeded', {
      commandName: name,
      reply,
    } as CommandSucceededEvent);
  }
}

describe('QueryMetricsCollector (stats-charts performance)', () => {
  let client: FakeClient;
  let collector: QueryMetricsCollector;

  beforeEach(() => {
    client = new FakeClient();
    collector = new QueryMetricsCollector(client as never);
  });

  afterEach(() => {
    collector.stop();
  });

  it('starts at zero', () => {
    expect(collector.snapshot()).toEqual({
      queries: 0,
      roundTrips: 0,
      docsReturned: 0,
    });
  });

  it('counts one query and one document for a single find', () => {
    collector.start();
    client.start('find', { find: 'workoutsessions' });
    client.succeed('find', { nReturned: 12 });
    const metrics = collector.stop();

    expect(metrics.queries).toBe(1);
    expect(metrics.roundTrips).toBe(1);
    expect(metrics.docsReturned).toBe(12);
  });

  it('ignores commands issued before start()', () => {
    client.start('find');
    client.succeed('find', { nReturned: 99 });
    collector.start();
    expect(collector.snapshot()).toEqual({
      queries: 0,
      roundTrips: 0,
      docsReturned: 0,
    });
  });

  it('ignores commands issued after stop()', () => {
    collector.start();
    collector.stop();
    client.start('find');
    client.succeed('find', { nReturned: 99 });
    expect(collector.snapshot().roundTrips).toBe(0);
  });

  it('excludes getMore and killCursors from queries but keeps them as round trips', () => {
    collector.start();
    client.start('find');
    client.succeed('find', { nReturned: 50 });
    client.start('getMore');
    client.succeed('getMore', { nReturned: 50 });
    client.start('getMore');
    client.succeed('getMore', { nReturned: 12 });
    client.start('killCursors');
    client.succeed('killCursors', {});
    const metrics = collector.stop();

    expect(metrics.queries).toBe(1);
    expect(metrics.roundTrips).toBe(4);
    expect(metrics.docsReturned).toBe(112);
  });

  it('sums nReturned across cursor batches', () => {
    collector.start();
    for (let i = 0; i < 5; i++) {
      client.start('find');
      client.succeed('find', { nReturned: 101 });
    }
    expect(collector.stop().docsReturned).toBe(505);
  });

  it('treats a missing nReturned as zero documents', () => {
    collector.start();
    client.start('find');
    client.succeed('find', {});
    client.start('findOne');
    client.succeed('findOne', { value: { _id: 'x' } });
    const metrics = collector.stop();

    expect(metrics.queries).toBe(2);
    expect(metrics.docsReturned).toBe(0);
  });

  it('handles a non-numeric nReturned defensively', () => {
    collector.start();
    client.start('find');
    client.succeed('find', { nReturned: '12' });
    expect(collector.stop().docsReturned).toBe(0);
  });

  it('ignores aggregate and other command types as documents but counts them', () => {
    collector.start();
    client.start('aggregate', { aggregate: 'workoutsessions' });
    client.succeed('aggregate', { nReturned: 7 });
    const metrics = collector.stop();

    expect(metrics.queries).toBe(1);
    expect(metrics.docsReturned).toBe(7);
  });

  it('returns an independent copy so later commands cannot mutate a snapshot', () => {
    collector.start();
    client.start('find');
    client.succeed('find', { nReturned: 5 });
    const snapshot = collector.snapshot();
    client.start('find');
    client.succeed('find', { nReturned: 5 });

    expect(snapshot.docsReturned).toBe(5);
    expect(collector.snapshot().docsReturned).toBe(10);
  });

  it('is reusable across consecutive measured windows', () => {
    collector.start();
    client.start('find');
    client.succeed('find', { nReturned: 10 });
    const first = collector.stop();

    collector.start();
    client.start('find');
    client.succeed('find', { nReturned: 3 });
    const second = collector.stop();

    expect(first).toEqual({ queries: 1, roundTrips: 1, docsReturned: 10 });
    expect(second).toEqual({ queries: 1, roundTrips: 1, docsReturned: 3 });
  });

  it('ignores an event with no commandName', () => {
    collector.start();
    client.emit('commandStarted', {});
    client.emit('commandSucceeded', { reply: { nReturned: 4 } });
    expect(collector.stop()).toEqual({
      queries: 0,
      roundTrips: 0,
      docsReturned: 0,
    });
  });
});
