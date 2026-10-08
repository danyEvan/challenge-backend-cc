import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { setupApplication } from './app.setup.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  setupApplication(app);
  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Cocos Capital - Investment API')
    .setDescription(
      'Search market instruments, submit orders and retrieve account portfolios.',
    )
    .setVersion('1.0.0')
    .addTag('Health', 'Application and database readiness')
    .addTag('Instruments', 'Search market assets by ticker or name')
    .addTag('Portfolio', 'Account cash, reservations, positions and valuation')
    .addTag('Orders', 'Submit BUY or SELL market and limit orders')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = app.get(ConfigService).getOrThrow<number>('PORT');
  await app.listen(port);
  console.log(`Application running on port ${port}`);
  console.log(
    `Swagger documentation available at http://localhost:${port}/api/docs`,
  );
}

await bootstrap();
