import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function readSrc(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

describe('Apex Grok proxy foundation', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.GROK_API_KEY;
    delete process.env.GROK_PROXY_API_KEY;
    delete process.env.GROK_PROXY_URL;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('detects proxy configuration from GROK_PROXY_API_KEY', async () => {
    process.env.GROK_PROXY_API_KEY = 'apex-proxy-secret';
    const { isGrokProxyConfigured } = await import('../../src/lib/grokApiKey.shared');
    assert.equal(isGrokProxyConfigured(), true);
  });

  it('isGrokConfigured accepts proxy-only Apex dealer nodes', async () => {
    process.env.GROK_PROXY_API_KEY = 'apex-proxy-secret';
    const { isGrokConfigured } = await import('../../src/lib/grok');
    assert.equal(isGrokConfigured(), true);
  });

  it('keeps Merlinus direct-path default when proxy is unset', async () => {
    process.env.GROK_API_KEY = 'xai-direct-key';
    const grokSrc = readSrc('src/lib/grok.ts');
    assert.match(grokSrc, /shouldUseApexGrokProxy/);
    assert.match(grokSrc, /transport: 'direct'/);
    assert.doesNotMatch(grokSrc, /import 'server-only'/);
    const { isGrokProxyConfigured } = await import('../../src/lib/grokApiKey.shared');
    assert.equal(isGrokProxyConfigured(), false);
  });

  it('proxy route authenticates with GROK_PROXY_API_KEY', async () => {
    process.env.GROK_PROXY_API_KEY = 'apex-proxy-secret';
    process.env.GROK_API_KEY = 'xai-upstream-key';
    const { POST } = await import('../../src/app/api/grok/proxy/route');

    const unauthorized = await POST(
      new Request('http://localhost/api/grok/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
      })
    );
    assert.equal(unauthorized.status, 401);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({ choices: [{ message: { content: 'ok' } }] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );

    try {
      const authorized = await POST(
        new Request('http://localhost/api/grok/proxy', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer apex-proxy-secret',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'grok-4.3',
            messages: [{ role: 'user', content: 'hi' }],
            temperature: 0.1,
            max_tokens: 32,
          }),
        })
      );
      assert.equal(authorized.status, 200);
      const payload = (await authorized.json()) as { choices?: Array<{ message?: { content?: string } }> };
      assert.equal(payload.choices?.[0]?.message?.content, 'ok');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});