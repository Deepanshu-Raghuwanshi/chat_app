import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from '@shared-exceptions/index';
import { RedisIoAdapter } from './infrastructure/messaging/websocket.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('api/v1');

  // WebSocket Adapter
  const redisIoAdapter = new RedisIoAdapter(app);
  const redisHost = process.env.REDIS_HOST || 'localhost';
  const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
  await redisIoAdapter.connectToRedis(redisHost, redisPort);
  app.useWebSocketAdapter(redisIoAdapter);

  app.useGlobalFilters(new GlobalExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Chat Service')
    .setDescription('Real-time Chat Service API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3003;
  await app.listen(port);
  console.log(`🚀 Chat Service is running on: http://localhost:${port}/api/v1`);
  console.log(`📖 Swagger docs: http://localhost:${port}/api/docs`);
}

bootstrap();
