import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common/pipes/validation.pipe';
import { json, urlencoded } from 'express'; // Dodany import z express

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ZMIANA: Zwiększenie limitu wielkości payloadu dla przesyłania zdjęć w Base64
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));

  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // EVENTFLOW_PRODUCT_POLISH_V3:
  // Rozszerzamy CORS, żeby można było równolegle odpalać kilka wersji frontu.
  // Nie usuwa to istniejącego zachowania dla localhost:3000.
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3010',
      'http://localhost:3020',
    ],
    credentials: true,
  });

  const port = Number(process.env.API_PORT ?? process.env.PORT ?? 3002);
  await app.listen(port);
  console.log(`API działa na http://localhost:${port}/api`);
}
bootstrap();