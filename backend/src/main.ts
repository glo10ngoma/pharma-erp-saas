import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { BusinessErrorFilter } from './common/filters/business-error.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');
  const allowedOrigins = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: allowedOrigins.length ? allowedOrigins : true,
    credentials: true,
  });
  app.useGlobalFilters(new BusinessErrorFilter());

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  const config = new DocumentBuilder()
    .setTitle('ERP Pharmaceutique SaaS V2 API')
    .setDescription('API REST NestJS pour ERP Pharmaceutique SaaS multi-tenant')
    .setVersion('1.0')
    .addTag('auth')
    .addTag('users')
    .addTag('roles')
    .addTag('permissions')
    .addTag('sites')
    .addTag('articles')
    .addTag('reference')
    .addTag('purchases')
    .addTag('lots')
    .addTag('stocks')
    .addTag('stock-movements')
    .addTag('sales')
    .addTag('payments')
    .addTag('cash')
    .addTag('organizations')
    .addTag('insurance-plans')
    .addTag('memberships')
    .addTag('receivables')
    .addTag('inventories')
    .addTag('accounting')
    .addTag('reports')
    .addTag('settings')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  await app.listen(process.env.PORT || process.env.APP_PORT || 3000);
}

bootstrap();
