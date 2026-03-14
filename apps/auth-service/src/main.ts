import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from '@shared-exceptions';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Use Pino Logger
  app.useLogger(app.get(Logger));

  // Cookie Parser
  app.use(cookieParser());

  // CORS
  const configService = app.get(ConfigService);
  app.enableCors({
    origin: configService.get<string>('CORS_ORIGIN'),
    credentials: true,
  });

  // Global Prefix
  app.setGlobalPrefix('api/v1');

  // Global Filter
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Global Pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Swagger Documentation
  const config = new DocumentBuilder()
    .setTitle('Auth Service')
    .setDescription('Authentication Service API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`Auth Service is running on: http://localhost:${port}/api/v1`);
  console.log(`Swagger docs: http://localhost:${port}/api/docs`);
}

bootstrap();
