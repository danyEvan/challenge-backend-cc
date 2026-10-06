export type Environment = Record<string, unknown> & {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  DATABASE_URL: string;
};

export function validateEnvironment(
  input: Record<string, unknown>,
): Environment {
  const nodeEnv = input.NODE_ENV ?? 'development';
  if (
    nodeEnv !== 'development' &&
    nodeEnv !== 'test' &&
    nodeEnv !== 'production'
  ) {
    throw new Error('NODE_ENV must be development, test or production');
  }

  const port = Number(input.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  if (typeof input.DATABASE_URL !== 'string' || !input.DATABASE_URL.trim()) {
    throw new Error('DATABASE_URL is required');
  }

  let url: URL;
  try {
    url = new URL(input.DATABASE_URL);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL');
  }
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !url.hostname ||
    url.pathname.length <= 1 ||
    (url.port &&
      (!/^\d+$/.test(url.port) ||
        Number(url.port) > 65535 ||
        Number(url.port) < 1))
  ) {
    throw new Error(
      'DATABASE_URL must specify a PostgreSQL host, database and valid port',
    );
  }

  if (
    ['host', 'port', 'user', 'password', 'database'].some((key) =>
      url.searchParams.has(key),
    )
  ) {
    throw new Error(
      'DATABASE_URL must specify its connection target in the URL authority and path',
    );
  }

  // pg vuelve a interpretar el SSL de la URL. Usamos una sola fuente.
  if (url.searchParams.has('ssl') || url.searchParams.has('uselibpqcompat')) {
    throw new Error('DATABASE_URL must configure TLS using sslmode only');
  }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  const sslMode =
    url.searchParams.get('sslmode') ?? (local ? 'disable' : 'verify-full');
  if (!['disable', 'require', 'verify-full'].includes(sslMode)) {
    throw new Error(
      'DATABASE_URL sslmode must be disable, require or verify-full',
    );
  }
  // Las conexiones remotas verifican certificado y host, incluso con require.
  url.searchParams.set(
    'sslmode',
    sslMode === 'require' ? 'verify-full' : sslMode,
  );

  return {
    ...input,
    NODE_ENV: nodeEnv,
    PORT: port,
    DATABASE_URL: url.toString(),
  };
}
