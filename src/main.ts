import 'module-alias/register';
import cookieParser from 'cookie-parser';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { json, urlencoded } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  app.use(json({ limit: '5mb' }));
  app.use(urlencoded({ extended: true, limit: '5mb' }));

  // Trust proxy for Secure cookies behind Render/Vercel proxies
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  app.use(cookieParser());

  app.enableCors({
    origin: [
      'https://wave-fit-front.onrender.com',
      'https://wave-fit.vercel.app',
      'http://localhost:4200',
    ],
    credentials: true,
  });

  // app.useGlobalFilters(new GraphQLExceptionFilter());

  const port = process.env.PORT || 3000;
  await app.listen(port);
}

bootstrap();
