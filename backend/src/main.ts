import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // Prefijo global para la API
  app.setGlobalPrefix('api');

  // CORS para el frontend Angular
  app.enableCors({
    origin: ['http://localhost:4200', 'http://127.0.0.1:4200'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // Pipes globales: validación automática de DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Filtro global de excepciones
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Interceptor global de respuesta
  app.useGlobalInterceptors(new TransformInterceptor());

  const port = process.env.BACKEND_PORT || 3000;
  await app.listen(port);

  logger.log(`🚀 SGGI Backend corriendo en http://localhost:${port}/api`);
  logger.log(`📊 Entorno: ${process.env.NODE_ENV || 'development'}`);
}

bootstrap();
