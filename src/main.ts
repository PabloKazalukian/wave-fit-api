import 'module-alias/register';
import cookieParser from 'cookie-parser';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Trust proxy for Secure cookies behind Render/Vercel proxies
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  app.use(cookieParser());

  app.enableCors({
    origin:
      process.env.NODE_ENV === 'production'
        ? ['https://wave-fit-front.onrender.com', 'https://wave-fit.vercel.app']
        : 'http://localhost:4200',
    credentials: true,
  });

  // app.useGlobalFilters(new GraphQLExceptionFilter());

  const port = process.env.PORT || 3000;
  await app.listen(port);
}

bootstrap();
