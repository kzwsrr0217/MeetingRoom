import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

/**
 * Fail loudly at startup on a misconfigured live deployment, instead of only
 * surfacing errors later on the first request. Does not exit — the admin token
 * swap can still recover a graph-mode instance — but the banner is unmissable.
 */
function validateRuntimeConfig(logger: Logger) {
  const useMock = process.env.USE_MOCK_DATA?.trim() !== 'false';
  if (useMock) return;

  const hasAzure =
    !!process.env.AZURE_TENANT_ID && !!process.env.AZURE_CLIENT_ID && !!process.env.AZURE_CLIENT_SECRET;
  const hasToken = !!process.env.GRAPH_TEMP_TOKEN?.trim();

  if (!hasAzure && !hasToken) {
    logger.error(
      '████ LIVE (graph) MODE BUT NO CREDENTIALS ████ ' +
        'Set AZURE_TENANT_ID/AZURE_CLIENT_ID/AZURE_CLIENT_SECRET (recommended) or GRAPH_TEMP_TOKEN, ' +
        'or set USE_MOCK_DATA=true. Every room request will fail until then.',
    );
  } else {
    logger.log(`Live mode credentials present (${hasAzure ? 'MSAL app' : 'manual token'}).`);
  }
  if (!process.env.ADMIN_API_KEY?.trim()) {
    logger.warn('ADMIN_API_KEY is not set — admin/mutating endpoints are UNPROTECTED.');
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  validateRuntimeConfig(new Logger('Config'));

  // Restrict CORS to the configured frontend origin(s). FRONTEND_URL may be a
  // comma-separated list. Falls back to the Vite dev origin for local work.
  const allowed = (process.env.FRONTEND_URL ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: allowed,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'x-admin-key'],
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  new Logger('Bootstrap').log(`Backend listening on :${port} — CORS allowed: ${allowed.join(', ')}`);
}
bootstrap();
