import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { GraphQLExceptionFilter } from './common/filters/gpl-exeption.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();
  app.useGlobalFilters(new GraphQLExceptionFilter());

  const port = process.env.PORT || 3000;
  await app.listen(port);
}

bootstrap();
