import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from '@shared-exceptions';
import { json, urlencoded, Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { 
    bufferLogs: true,
    bodyParser: false, // Disable default body parsing to allow proxying raw streams
  });

  app.use(cookieParser());

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.headers['content-type']?.includes('multipart/form-data')) {
      next();
    } else {
      json({ limit: '50mb' })(req, res, next);
    }
  });
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.headers['content-type']?.includes('multipart/form-data')) {
      next();
    } else {
      urlencoded({ limit: '50mb', extended: true })(req, res, next);
    }
  });

  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('api/v1');

  const configService = app.get(ConfigService);
  app.enableCors({
    origin: true, // For development, allow all origins to send credentials
    credentials: true,
  });

  app.useGlobalFilters(new GlobalExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('API Gateway')
    .setDescription('Unified Entry Point for Chat System')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`API Gateway is running on: http://localhost:${port}/api/v1`);
  console.log(`Swagger docs: http://localhost:${port}/api/docs`);
}

bootstrap();
