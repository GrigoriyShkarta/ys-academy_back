import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';
import { ValidationPipe } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useWebSocketAdapter(new IoAdapter(app));

  app.enableCors({
    origin: [
      'https://ys-academy.vercel.app',
      'https://ys-academy-dev.vercel.app',
      'http://localhost:3000',
      'http://localhost:4000',
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-Requested-With',
      'Origin',
      'X-HTTP-Method-Override',
    ],
    credentials: true,
    optionsSuccessStatus: 204,
    preflightContinue: false,
  });

  console.log('CORS ENABLED');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  console.log('PIPES SET');

  const port = Number(process.env.PORT);
  if (!port) throw new Error('PORT is not defined');

  await app.listen(port, '0.0.0.0');
  console.log('LISTENING ON', port);
}
void bootstrap();
