import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';
import { ValidationPipe } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Set WebSocket adapter early
  app.useWebSocketAdapter(new IoAdapter(app));

  // Comprehensive and highly-compatible CORS configuration for Vercel <-> Heroku communication
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, tools, etc.)
      if (!origin) return callback(null, true);

      const allowedOrigins = [
        'https://ys-academy.vercel.app',
        'https://ys-academy-dev.vercel.app',
        'http://localhost:3000',
        'http://localhost:4000',
      ];

      // Robust origin checking
      const isAllowed =
        allowedOrigins.includes(origin) ||
        origin.endsWith('.vercel.app') ||
        /^http:\/\/localhost:\d+$/.test(origin);

      if (isAllowed) {
        callback(null, true);
      } else {
        // Log the denied origin to help troubleshoot if needed
        console.warn(`[CORS DENIED] Origin: ${origin}`);
        callback(null, false);
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'authorization',
      'X-HTTP-Method-Override',
    ],
    // Force preflight success for all headers listed above
    preflightContinue: false,
    optionsSuccessStatus: 200,
  });

  console.log('CORS CONFIGURED SUCCESSFULLY');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  
  const port = Number(process.env.PORT);
  if (!port) {
    throw new Error('PORT is not defined');
  }

  await app.listen(port, '0.0.0.0');
  console.log(`APPLICATION IS LISTENING ON PORT ${port}`);
}

void bootstrap();
