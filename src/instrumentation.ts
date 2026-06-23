export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateEnvironment } = await import('./lib/env');
    validateEnvironment({ throwOnError: process.env.NODE_ENV === 'production' });
  }
}