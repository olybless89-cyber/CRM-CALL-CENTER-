import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureApp } from './setup-app';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));
  configureApp(app);

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Digital Weboracle CRM + Contact Center API')
    .setDescription(
      'Foundation milestone API: tenants, users, RBAC, auth. See /docs/architecture for the full architecture.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = resolvePort();
  await app.listen(port);
}

function resolvePort(): number {
  for (const candidate of [process.env.PORT, process.env.API_PORT]) {
    if (candidate && candidate.trim() !== '') {
      const parsed = Number(candidate);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }
  return 4000;
}

void bootstrap();
