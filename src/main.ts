import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Cocos Capital - Investment API')
    .setDescription(
      'REST API for searching market instruments, managing orders (MARKET & LIMIT), and querying portfolio balances.',
    )
    .setVersion('1.0.0')
    .addTag('Health', 'Health check and readiness probes')
    .addTag('Instruments', 'Search market assets by ticker or name')
    .addTag('Orders', 'Submit and manage market/limit orders')
    .addTag('Portfolio', 'User account portfolio and asset positions')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Application running on port ${port}`);
  console.log(`Swagger documentation available at http://localhost:${port}/api/docs`);
}

await bootstrap();
