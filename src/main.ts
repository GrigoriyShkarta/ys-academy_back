import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';
import { ValidationPipe } from '@nestjs/common';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    // origin: [
    //   'http://localhost:3000',
    //   'https://ys-academy.vercel.app',
    //   'https://ys-academy-dev.vercel.app',
    // ],
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // удаляет лишние поля
      forbidNonWhitelisted: true, // запрещает лишние поля
      transform: true, // автоматически преобразует объекты в DTO
    }),
  );

  const port = process.env.PORT || 4000;

  // ⬇️ ВАЖНО: Слушать на 0.0.0.0, а не localhost!
  await app.listen(port, '0.0.0.0');
}
void bootstrap();
