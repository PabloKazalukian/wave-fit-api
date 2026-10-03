/**
 * The k6 query documents must be valid against the schema the application
 * actually serves (`FR-009`, `TEST-011`).
 *
 * Why this exists: the in-process bench calls the calculators directly and never
 * goes through GraphQL, so it cannot tell whether a query document matches the
 * code-first schema. `TEST-007` parses the script with the k6 binary, which
 * only proves the *JavaScript* is well formed — `graphql.parse` stops at the
 * document's syntax and never compares a field name against a type.
 *
 * The gap was not theoretical. The first live k6 run failed 6 of its 7 scenarios
 * with `GRAPHQL_VALIDATION_FAILED`: `getStats1RmWeekly` was asked for
 * `exerciseName`, `weekKey` and `best1RM` on the flat `Exercise1RmWeekly` type,
 * which exposes `exerciseId`, `name`, `category` and a nested `weeks`. Only
 * `getStatsCaloriesWeekly` happened to be spelled correctly. The run was still
 * *measured* — fast, error-free timings of responses that contained nothing but
 * validation errors — so only the `checks` threshold saved the result from
 * being read as a pass.
 *
 * This test builds the real schema from the real resolver and validates every
 * document the script sends, so a field rename in the presentation entities
 * turns this suite red instead of the next live run.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Test } from '@nestjs/testing';
import { GraphQLSchemaBuilderModule, GraphQLSchemaFactory } from '@nestjs/graphql';
import { parse, validate, type GraphQLSchema, type DocumentNode } from 'graphql';
import { StatsChartsResolver } from '../../src/modules/stats-charts/stats-charts.resolver';

const K6_SCRIPT = join(__dirname, '..', 'load', 'stats-charts.js');
const scriptSource = readFileSync(K6_SCRIPT, 'utf8');

/** Every query document the script can put on the wire, in scenario order. */
const QUERY_DOCUMENTS = [
  'ONE_RM_QUERY',
  'VOLUME_WEEKLY_QUERY',
  'VOLUME_TOTAL_QUERY',
  'CALORIES_QUERY',
  'FORGOTTEN_QUERY',
  'TREND_QUERY',
  'DASHBOARD_QUERY',
] as const;

function extractDocument(constant: string): DocumentNode {
  const match = scriptSource.match(
    new RegExp(`const ${constant} = \`([\\s\\S]*?)\`;`),
  );
  if (!match) {
    throw new Error(`${constant} not found in the k6 script.`);
  }
  return parse(match[1]);
}

describe('k6 queries against the served schema (TEST-011)', () => {
  let schema: GraphQLSchema;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [GraphQLSchemaBuilderModule],
    }).compile();
    const schemaFactory = moduleRef.get(GraphQLSchemaFactory);
    schema = await schemaFactory.create([StatsChartsResolver], []);
  });

  it.each(QUERY_DOCUMENTS)(
    '%s validates against the real code-first schema',
    (constant) => {
      const errors = validate(schema, extractDocument(constant));
      expect(
        errors.map((error) => error.message),
      ).toEqual([]);
    },
  );

  it('covers the six chart queries, and the dashboard requests all six at once', () => {
    const fieldsOf = (constant: string): string[] => {
      const document = extractDocument(constant);
      return (document.definitions as any[])
        .filter((definition) => definition.kind === 'OperationDefinition')
        .flatMap((operation: any) =>
          operation.selectionSet.selections.map(
            (selection: any) => selection.name.value,
          ),
        );
    };

    for (const constant of [
      'ONE_RM_QUERY',
      'VOLUME_WEEKLY_QUERY',
      'VOLUME_TOTAL_QUERY',
      'CALORIES_QUERY',
      'FORGOTTEN_QUERY',
      'TREND_QUERY',
    ]) {
      expect(fieldsOf(constant)).toHaveLength(1);
    }

    // The dashboard is one document requesting the six charts together, which is
    // what makes it a single round trip rather than six.
    expect(fieldsOf('DASHBOARD_QUERY')).toHaveLength(6);
  });
});