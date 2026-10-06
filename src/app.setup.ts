import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';

export function setupApplication(app: INestApplication): void {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
