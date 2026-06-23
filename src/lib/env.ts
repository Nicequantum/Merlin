const REQUIRED_ENV_VARS = ['DATABASE_URL', 'ENCRYPTION_KEY', 'SESSION_SECRET'] as const;

const RECOMMENDED_ENV_VARS = ['GROK_API_KEY', 'BLOB_READ_WRITE_TOKEN'] as const;

export interface EnvironmentValidationResult {
  missing: string[];
  warnings: string[];
}

export function validateEnvironment(options: { throwOnError?: boolean } = {}): EnvironmentValidationResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const key of REQUIRED_ENV_VARS) {
    if (!process.env[key]?.trim()) {
      missing.push(key);
    }
  }

  const encryptionKey = process.env.ENCRYPTION_KEY?.trim();
  if (encryptionKey && encryptionKey.length < 32) {
    warnings.push('ENCRYPTION_KEY is shorter than 32 characters');
  }

  const sessionSecret = process.env.SESSION_SECRET?.trim();
  if (sessionSecret && sessionSecret.length < 32) {
    warnings.push('SESSION_SECRET is shorter than the recommended 32 characters');
  }

  for (const key of RECOMMENDED_ENV_VARS) {
    if (!process.env[key]?.trim()) {
      warnings.push(`${key} not configured`);
    }
  }

  if (!process.env.KV_REST_API_URL?.trim() || !process.env.KV_REST_API_TOKEN?.trim()) {
    warnings.push('KV_REST_API_URL/KV_REST_API_TOKEN not configured — distributed rate limiting disabled');
  }

  if (missing.length > 0) {
    const message = `Missing required environment variables: ${missing.join(', ')}`;
    console.error(message);

    if (options.throwOnError) {
      throw new Error(message);
    }
  }

  for (const warning of warnings) {
    console.warn(`Environment warning: ${warning}`);
  }

  return { missing, warnings };
}