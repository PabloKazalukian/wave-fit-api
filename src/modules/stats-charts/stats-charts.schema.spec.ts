import { Test } from '@nestjs/testing';
import { GraphQLSchemaFactory, GraphQLSchemaBuilderModule } from '@nestjs/graphql';
import { printSchema } from 'graphql';
import { StatsChartsResolver } from './stats-charts.resolver';

describe('StatsCharts schema generation (stats-charts)', () => {
  let schemaFactory: GraphQLSchemaFactory;
  let sdl: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [GraphQLSchemaBuilderModule],
    }).compile();
    schemaFactory = moduleRef.get(GraphQLSchemaFactory);
    const schema = await schemaFactory.create([StatsChartsResolver], []);
    sdl = printSchema(schema);
  });

  it('generates the code-first schema without undefined-type errors', () => {
    expect(sdl).toContain('type Query');
  });

  it('exposes the six chart queries', () => {
    for (const query of [
      'getStats1RmWeekly',
      'getStatsVolumeWeekly',
      'getStatsVolumeTotalWeekly',
      'getStatsCaloriesWeekly',
      'getStatsForgottenMuscles',
      'getStatsExerciseTrend',
    ]) {
      expect(sdl).toContain(query);
    }
  });

  it('maps nullable Date fields to the DateTime scalar', () => {
    expect(sdl).toContain('lastTrainedAt: DateTime');
  });

  it('uses the shared StatsChartsInput for every query', () => {
    const executions = sdl.match(/input: StatsChartsInput!/g);
    expect(executions).toHaveLength(6);
  });
});