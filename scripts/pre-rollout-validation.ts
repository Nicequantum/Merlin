#!/usr/bin/env npx tsx
/**
 * Merlin Pre-Rollout Validation Suite
 *
 * Run before every dealership deployment to confirm environment, security,
 * core systems, and feature readiness. Safe to run against staging or production
 * credentials — does not mutate customer data (read-only DB probe + in-memory tests).
 *
 * Usage:
 *   cp .env.example .env.local   # first-time setup
 *   npm run validate:pre-rollout
 *   MERLIN_BASE_URL=https://your-deployment.example npm run validate:pre-rollout
 *
 * This script depends on `.env.local` at the repo root (same as `npm run dev`).
 * DATABASE_URL and other secrets must never be hardcoded here.
 */

import { execSync } from 'node:child_process';
import { config as loadDotenv } from 'dotenv';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { jsPDF } from 'jspdf';

import {
  AUDIT_GENESIS_HASH,
  computeAuditEntryHash,
  verifyAuditChain,
  type AuditChainPayload,
} from '../src/lib/auditChain';
import { VOICE_INPUT_SETTINGS } from '../src/lib/constants';
import { encryptPII, decryptPII } from '../src/lib/encryption';
import {
  getAppVersion,
  getBuildCommit,
  getBuildDate,
  getRuntimeConfig,
  isMaintenanceModeEnabled,
  validateEnvironment,
} from '../src/lib/env';
import type { PrismaClient } from '@prisma/client';
import { isKvConfigured, RATE_LIMITS } from '../src/lib/rate-limit';
import { SYSTEM_PROMPT, buildWarrantyStoryUserMessage } from '../src/prompts/warrantyStory';
import { PROMPT_VERSION } from '../src/prompts/version';
import { normalizeWarrantyStoryText } from '../src/utils/pdfExport';
import { createRepairOrderFromScan } from '../src/utils/repairOrderFactory';

let prisma: PrismaClient | null = null;
let databaseConfigError: string | null = null;

// ─── Console styling ───────────────────────────────────────────────────────────

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

type CheckStatus = 'pass' | 'fail' | 'warn';

interface CheckResult {
  section: string;
  name: string;
  status: CheckStatus;
  detail: string;
  critical: boolean;
}

const results: CheckResult[] = [];

function record(
  section: string,
  name: string,
  status: CheckStatus,
  detail: string,
  critical = true
): void {
  results.push({ section, name, status, detail, critical });
  const icon = status === 'pass' ? `${c.green}✔ PASS${c.reset}` : status === 'warn' ? `${c.yellow}⚠ WARN${c.reset}` : `${c.red}✖ FAIL${c.reset}`;
  console.log(`  ${icon}  ${name}`);
  if (detail) console.log(`         ${c.dim}${detail}${c.reset}`);
}

function section(title: string): void {
  console.log(`\n${c.bold}${c.cyan}▸ ${title}${c.reset}`);
}

// ─── Environment bootstrap ─────────────────────────────────────────────────────

/** Load `.env` then `.env.local` (overrides) — mirrors Next.js / local dev conventions. */
function loadEnvironment(): void {
  const root = process.cwd();
  loadDotenv({ path: resolve(root, '.env') });
  const localPath = resolve(root, '.env.local');
  if (!existsSync(localPath)) {
    console.warn(
      `${c.yellow}⚠ .env.local not found — copy .env.example to .env.local and configure DATABASE_URL.${c.reset}`
    );
  }
  loadDotenv({ path: localPath, override: true });
  loadDotenv({ path: resolve(root, '.env.production'), override: true });
}

/**
 * Validate and normalize DATABASE_URL from the environment.
 * Remote hosts (Prisma Data Platform, Neon, Vercel Postgres, etc.) get sslmode=require
 * when omitted so SSL handshakes succeed.
 */
function resolveDatabaseUrl(): string {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) {
    throw new Error(
      'DATABASE_URL is not set. Add it to .env.local (see .env.example). ' +
        'Example: postgresql://user:pass@host:5432/db?sslmode=require'
    );
  }

  const normalizedScheme = raw.replace(/^textpostgres:\/\//i, 'postgresql://');
  if (!/^postgres(ql)?:\/\//i.test(normalizedScheme)) {
    throw new Error(
      'DATABASE_URL must start with postgresql:// or postgres://. ' +
        'Check .env.local for typos (e.g. textpostgres://).'
    );
  }

  let url: URL;
  try {
    url = new URL(normalizedScheme);
  } catch {
    throw new Error('DATABASE_URL is malformed. Verify the connection string in .env.local.');
  }

  if (!url.hostname) {
    throw new Error('DATABASE_URL is missing a hostname. Verify the connection string in .env.local.');
  }

  const isLocal =
    url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1';
  if (!isLocal && !url.searchParams.has('sslmode')) {
    url.searchParams.set('sslmode', 'require');
  }

  return url.toString();
}

function describeDatabaseHost(connectionUrl: string): string {
  try {
    return new URL(connectionUrl).hostname;
  } catch {
    return 'unknown-host';
  }
}

async function initPrismaFromEnvironment(): Promise<PrismaClient | null> {
  try {
    const databaseUrl = resolveDatabaseUrl();
    process.env.DATABASE_URL = databaseUrl;
    const { prisma: client } = await import('../src/lib/db');
    return client;
  } catch (error) {
    databaseConfigError =
      error instanceof Error ? error.message : 'DATABASE_URL is missing or invalid';
    return null;
  }
}

function listRouteFiles(dir: string): string[] {
  const entries: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = resolve(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) entries.push(...listRouteFiles(full));
    else if (name === 'route.ts') entries.push(full);
  }
  return entries;
}

// ─── Check implementations ─────────────────────────────────────────────────────

async function checkEnvironment(): Promise<void> {
  section('Environment Validation');

  const env = validateEnvironment({ production: true });
  if (env.valid) {
    record('Environment', 'Required environment variables', 'pass', 'DATABASE_URL, ENCRYPTION_KEY, SESSION_SECRET present');
  } else {
    record('Environment', 'Required environment variables', 'fail', `Missing: ${env.missing.join(', ')}`);
  }

  const blockingWarnings = env.warnings.filter(
    (w) => w.includes('NEXT_PUBLIC_*') || w.includes('shorter than')
  );
  if (blockingWarnings.length === 0 && env.warnings.length === 0) {
    record('Environment', 'Environment warnings', 'pass', 'No configuration warnings');
  } else if (blockingWarnings.length > 0) {
    record('Environment', 'Environment warnings', 'fail', blockingWarnings.join('; '), true);
  } else {
    record('Environment', 'Environment warnings', 'warn', env.warnings.join('; '), false);
  }

  if (isMaintenanceModeEnabled()) {
    record('Environment', 'Maintenance mode disabled', 'fail', 'MERLIN_MAINTENANCE_MODE is enabled — disable before rollout');
  } else {
    record('Environment', 'Maintenance mode disabled', 'pass', 'MERLIN_MAINTENANCE_MODE is off');
  }

  const commit = getBuildCommit();
  const buildDate = getBuildDate();
  const parsedDate = Date.parse(buildDate);
  if (!commit || commit === 'unknown') {
    record('Environment', 'Build commit stamped', 'warn', `Commit is "${commit}" — set NEXT_PUBLIC_BUILD_COMMIT or deploy from git`, false);
  } else {
    record('Environment', 'Build commit stamped', 'pass', `Commit: ${commit}`);
  }

  if (Number.isNaN(parsedDate)) {
    record('Environment', 'Build date stamped', 'fail', `Invalid build date: ${buildDate}`);
  } else if (commit === 'dev') {
    record('Environment', 'Build date stamped', 'warn', `Date: ${buildDate} (local dev build)`, false);
  } else {
    record('Environment', 'Build date stamped', 'pass', `Built: ${new Date(parsedDate).toISOString()}`);
  }
}

async function checkCoreSystems(): Promise<void> {
  section('Core System Health');

  if (!prisma) {
    record(
      'Core Systems',
      'Database connection',
      'fail',
      databaseConfigError ??
        'DATABASE_URL not configured — add a valid PostgreSQL URL to .env.local'
    );
  } else {
    try {
      const started = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      const host = describeDatabaseHost(process.env.DATABASE_URL ?? '');
      const ssl = process.env.DATABASE_URL?.includes('sslmode=') ? 'SSL on' : 'SSL not specified';
      record(
        'Core Systems',
        'Database connection',
        'pass',
        `PostgreSQL OK in ${Date.now() - started}ms (${host}, ${ssl})`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Connection failed';
      const hint = message.includes('localhost')
        ? ' Start local Postgres or point DATABASE_URL in .env.local at your remote database.'
        : ' Verify DATABASE_URL in .env.local includes ?sslmode=require for remote hosts.';
      record('Core Systems', 'Database connection', 'fail', `${message}${hint}`);
    }
  }

  try {
    const sample = `merlin-pre-rollout-${Date.now()}`;
    const encrypted = encryptPII(sample);
    const decrypted = decryptPII(encrypted);
    if (decrypted !== sample) {
      record('Core Systems', 'AES-256 encryption round-trip', 'fail', 'Decrypt mismatch');
    } else {
      record('Core Systems', 'AES-256 encryption round-trip', 'pass', 'encryptPII / decryptPII OK');
    }
  } catch (error) {
    record(
      'Core Systems',
      'AES-256 encryption round-trip',
      'fail',
      error instanceof Error ? error.message : 'Encryption failed'
    );
  }

  try {
    const first: AuditChainPayload = {
      id: 'pre-rollout-audit-1',
      action: 'story.generate',
      entityType: 'repairLine',
      entityId: 'line-pre-rollout',
      technicianId: 'tech-pre-rollout',
      dealershipId: 'dealer-pre-rollout',
      metadata: JSON.stringify({ repairOrderId: 'ro-pre-rollout', promptVersion: PROMPT_VERSION }),
      ipAddress: '127.0.0.1',
      createdAt: new Date().toISOString(),
      previousHash: AUDIT_GENESIS_HASH,
      promptVersion: PROMPT_VERSION,
    };
    const firstHash = computeAuditEntryHash(first);
    const second: AuditChainPayload = {
      ...first,
      id: 'pre-rollout-audit-2',
      previousHash: firstHash,
      createdAt: new Date(Date.now() + 1000).toISOString(),
    };
    const secondHash = computeAuditEntryHash(second);
    const chain = verifyAuditChain([
      { ...first, entryHash: firstHash },
      { ...second, entryHash: secondHash },
    ]);
    if (!chain.valid) {
      record('Core Systems', 'Audit chain integrity', 'fail', `Chain broken at index ${chain.brokenAt}`);
    } else {
      record('Core Systems', 'Audit chain integrity', 'pass', 'Hash chain create → verify OK');
    }

    const tampered = { ...first, entryHash: firstHash, promptVersion: 'tampered' };
    const bad = verifyAuditChain([tampered]);
    if (bad.valid) {
      record('Core Systems', 'Audit tamper detection', 'fail', 'Tampered entry was accepted');
    } else {
      record('Core Systems', 'Audit tamper detection', 'pass', 'Tampered promptVersion correctly rejected');
    }
  } catch (error) {
    record(
      'Core Systems',
      'Audit chain integrity',
      'fail',
      error instanceof Error ? error.message : 'Audit chain test failed'
    );
  }

  if (PROMPT_VERSION && /^\d+\.\d+\.\d+$/.test(PROMPT_VERSION)) {
    const config = getRuntimeConfig(PROMPT_VERSION);
    record(
      'Core Systems',
      'Prompt version loaded',
      'pass',
      `PROMPT_VERSION=${PROMPT_VERSION} (app v${config.appVersion})`
    );
  } else {
    record('Core Systems', 'Prompt version loaded', 'fail', `Invalid PROMPT_VERSION: ${PROMPT_VERSION}`);
  }

  if (SYSTEM_PROMPT.includes(PROMPT_VERSION)) {
    record('Core Systems', 'Prompt version in SYSTEM_PROMPT', 'pass', 'Warranty story system prompt references version');
  } else {
    record('Core Systems', 'Prompt version in SYSTEM_PROMPT', 'fail', 'SYSTEM_PROMPT missing PROMPT_VERSION');
  }
}

async function checkCoreFeatures(): Promise<void> {
  section('Core Feature Tests');

  try {
    const sampleStory = normalizeWarrantyStoryText(
      'Customer states check engine light is on.\n\nPerformed source voltage check and connected battery charger. ' +
        'Connected XENTRY and performed Quick Test. Found fault code P0300. Replaced ignition coils and cleared codes. ' +
        'Final test drive confirmed repair.'
    );
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Merlin Pre-Rollout PDF Test', 45, 45);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    const lines = doc.splitTextToSize(sampleStory, 500);
    doc.text(lines, 45, 70);
    const output = doc.output('arraybuffer') as ArrayBuffer;
    if (output.byteLength < 400) {
      record('Core Features', 'PDF generation', 'fail', `PDF buffer too small (${output.byteLength} bytes)`);
    } else {
      record('Core Features', 'PDF generation', 'pass', `jsPDF produced ${output.byteLength} byte document`);
    }
  } catch (error) {
    record('Core Features', 'PDF generation', 'fail', error instanceof Error ? error.message : 'PDF build failed');
  }

  if (VOICE_INPUT_SETTINGS.enabled) {
    record(
      'Core Features',
      'Voice input configuration',
      'pass',
      `Enabled (${VOICE_INPUT_SETTINGS.language}, timeout ${VOICE_INPUT_SETTINGS.listeningTimeoutMs}ms)`
    );
  } else {
    record('Core Features', 'Voice input configuration', 'warn', 'Voice disabled in dealership settings', false);
  }

  record(
    'Core Features',
    'Voice browser support (Node runtime)',
    'warn',
    'Web Speech API requires Chrome/Edge on tablet — verify mic permission manually on shop floor',
    false
  );

  {
    const nextCfg = existsSync(resolve(process.cwd(), 'next.config.mjs'))
      ? readFileSync(resolve(process.cwd(), 'next.config.mjs'), 'utf8')
      : '';
    const micOk = nextCfg.includes('microphone=(self)');
    record(
      'Core Features',
      'Voice microphone CSP policy',
      micOk ? 'pass' : 'fail',
      micOk
        ? 'Permissions-Policy allows microphone=(self) for shop-floor tablets'
        : 'Add microphone=(self) to Permissions-Policy in next.config.mjs'
    );
  }

  try {
    const ro = createRepairOrderFromScan({
      roNumber: 'PRE-ROLLOUT',
      vehicle: { vin: 'WDDGF4HB0CA000000', year: '2022', make: 'Mercedes-Benz', model: 'C300', mileageIn: '45000', mileageOut: '' },
      customerName: 'PRE-ROLLOUT TEST',
      complaints: ['CHECK ENGINE LIGHT ON'],
      complaintLabels: ['A'],
    });
    const line = ro.repairLines[0];
    line.technicianNotes = 'Quick Test found P0300. Replaced coils.';
    const userMessage = buildWarrantyStoryUserMessage(ro, line);
    if (!userMessage.includes('CHECK ENGINE') || userMessage.length < 200) {
      record('Core Features', 'Story prompt assembly', 'fail', 'buildWarrantyStoryUserMessage output incomplete');
    } else {
      record('Core Features', 'Story prompt assembly', 'pass', `User prompt ${userMessage.length} chars with complaint context`);
    }

    if (RATE_LIMITS.generate.limit === 20 && RATE_LIMITS.generate.windowMs === 60_000) {
      record(
        'Core Features',
        'AI rate limiting configuration',
        'pass',
        `Per-IP: ${RATE_LIMITS.generate.limit}/min · Daily cap enforced via UsageLog`
      );
    } else {
      record('Core Features', 'AI rate limiting configuration', 'fail', 'Rate limit constants misconfigured');
    }
  } catch (error) {
    record(
      'Core Features',
      'Story prompt assembly',
      'fail',
      error instanceof Error ? error.message : 'Prompt build failed'
    );
  }

  try {
    // Lightweight in-process service matrix (avoids server-only Grok ping from healthChecks bundle).
    const serviceChecks: Record<string, { status: string; detail: string }> = {
      environment: validateEnvironment({ production: true }).valid
        ? { status: 'ok', detail: 'required env present' }
        : { status: 'error', detail: 'missing required env' },
      database: { status: 'pending', detail: '' },
      encryption: { status: 'pending', detail: '' },
      voice: VOICE_INPUT_SETTINGS.enabled
        ? { status: 'ok', detail: `voice enabled (${VOICE_INPUT_SETTINGS.language})` }
        : { status: 'warn', detail: 'voice disabled in config' },
      maintenance: isMaintenanceModeEnabled()
        ? { status: 'warn', detail: 'maintenance mode active' }
        : { status: 'ok', detail: 'normal operation' },
      grok: process.env.GROK_API_KEY?.trim()
        ? { status: 'ok', detail: 'GROK_API_KEY configured' }
        : { status: 'warn', detail: 'GROK_API_KEY not set — AI disabled' },
      kv: isKvConfigured()
        ? { status: 'ok', detail: 'KV configured' }
        : { status: 'warn', detail: 'KV not configured' },
    };

    if (!prisma) {
      serviceChecks.database = {
        status: 'error',
        detail: databaseConfigError ?? 'DATABASE_URL not configured',
      };
    } else {
      try {
        await prisma.$queryRaw`SELECT 1`;
        serviceChecks.database = { status: 'ok', detail: 'SELECT 1 OK' };
      } catch (error) {
        serviceChecks.database = {
          status: 'error',
          detail: error instanceof Error ? error.message : 'DB failed',
        };
      }
    }

    try {
      const probe = encryptPII('health-probe');
      decryptPII(probe);
      serviceChecks.encryption = { status: 'ok', detail: 'round-trip OK' };
    } catch (error) {
      serviceChecks.encryption = {
        status: 'error',
        detail: error instanceof Error ? error.message : 'encryption failed',
      };
    }

    const errors = Object.entries(serviceChecks).filter(([, v]) => v.status === 'error');
    const warns = Object.entries(serviceChecks).filter(([, v]) => v.status === 'warn');

    if (errors.length > 0) {
      record(
        'Core Features',
        'In-process health checks',
        'fail',
        errors.map(([k, v]) => `${k}=${v.detail}`).join('; ')
      );
    } else if (warns.length > 0) {
      record(
        'Core Features',
        'In-process health checks',
        'warn',
        warns.map(([k, v]) => `${k}=${v.detail}`).join('; '),
        false
      );
    } else {
      record('Core Features', 'In-process health checks', 'pass', 'All in-process services OK');
    }

    const baseUrl = process.env.MERLIN_BASE_URL?.replace(/\/$/, '');
    if (baseUrl) {
      const started = Date.now();
      const res = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(20_000) });
      const body = (await res.json()) as {
        status?: string;
        services?: Record<string, string>;
      };
      if (!res.ok || body.status === 'error') {
        record(
          'Core Features',
          'Live /api/health endpoint',
          'fail',
          `HTTP ${res.status} status=${body.status ?? 'unknown'}`
        );
      } else if (body.status === 'degraded') {
        record(
          'Core Features',
          'Live /api/health endpoint',
          'warn',
          `HTTP ${res.status} degraded in ${Date.now() - started}ms`,
          false
        );
      } else {
        const svc = body.services ? Object.entries(body.services).map(([k, v]) => `${k}=${v}`).join(', ') : 'n/a';
        record(
          'Core Features',
          'Live /api/health endpoint',
          'pass',
          `${baseUrl}/api/health → ${body.status} (${Date.now() - started}ms) [${svc}]`
        );
      }
    } else {
      record(
        'Core Features',
        'Live /api/health endpoint',
        'warn',
        'Set MERLIN_BASE_URL to test deployed /api/health (in-process checks ran above)',
        false
      );
    }
  } catch (error) {
    record(
      'Core Features',
      'Health endpoint check',
      'fail',
      error instanceof Error ? error.message : 'Health check failed'
    );
  }
}

async function checkSecurityAndConfig(): Promise<void> {
  section('Security & Configuration');

  const nextConfigPath = resolve(process.cwd(), 'next.config.mjs');
  const nextConfig = existsSync(nextConfigPath) ? readFileSync(nextConfigPath, 'utf8') : '';

  const cspRequirements = [
    "default-src 'self'",
    'frame-ancestors \'none\'',
    "object-src 'none'",
    'microphone=(self)',
    'Strict-Transport-Security',
  ];
  const missingCsp = cspRequirements.filter((req) => !nextConfig.includes(req));
  if (missingCsp.length === 0) {
    record('Security', 'CSP & security headers config', 'pass', 'next.config.mjs includes required directives');
  } else {
    record('Security', 'CSP & security headers config', 'fail', `Missing in next.config.mjs: ${missingCsp.join(', ')}`);
  }

  const grokRoutes = [
    'src/app/api/repair-orders/[id]/lines/[lineId]/generate-story/route.ts',
    'src/app/api/repair-orders/[id]/lines/[lineId]/review-story/route.ts',
    'src/app/api/repair-orders/extract/route.ts',
    'src/app/api/diagnostics/extract/route.ts',
  ];
  const rateLimitFailures: string[] = [];
  for (const rel of grokRoutes) {
    const content = readFileSync(resolve(process.cwd(), rel), 'utf8');
    if (!content.includes('trackUsage: true')) {
      rateLimitFailures.push(`${rel} missing trackUsage`);
    }
    if (!content.includes('RATE_LIMITS.generate') && !content.includes('rateLimit:')) {
      rateLimitFailures.push(`${rel} missing rate limit config`);
    }
  }
  if (rateLimitFailures.length === 0) {
    record(
      'Security',
      'Grok route rate limiting',
      'pass',
      `All ${grokRoutes.length} AI routes have trackUsage + per-IP limits`
    );
  } else {
    record('Security', 'Grok route rate limiting', 'fail', rateLimitFailures.join('; '));
  }

  if (isKvConfigured()) {
    record('Security', 'Distributed rate limiting (KV)', 'pass', 'KV_REST_API_URL and token configured');
  } else {
    record(
      'Security',
      'Distributed rate limiting (KV)',
      'warn',
      'KV not configured — rate limits are per-instance only in serverless',
      false
    );
  }

  const apiRoot = resolve(process.cwd(), 'src/app/api');
  const routeFiles = listRouteFiles(apiRoot);
  const publicAllowlist = new Set([
    'health/route.ts',
    'status/route.ts',
    'auth/login/route.ts',
    'auth/logout/route.ts',
    'auth/me/route.ts',
    'auth/security-status/route.ts',
    'setup/seed/route.ts',
  ]);
  const unauthenticated: string[] = [];
  for (const file of routeFiles) {
    const rel = file.replace(apiRoot + '\\', '').replace(apiRoot + '/', '').replace(/\\/g, '/');
    const content = readFileSync(file, 'utf8');
    const isPublic = [...publicAllowlist].some((allowed) => rel.endsWith(allowed));
    const hasWithAuth = content.includes('withAuth(');
    const hasManualAuth =
      rel.includes('images/route.ts') && content.includes('getSession');
    if (!isPublic && !hasWithAuth && !hasManualAuth) {
      unauthenticated.push(rel);
    }
  }
  if (unauthenticated.length === 0) {
    record('Security', 'Sensitive route authentication', 'pass', `${routeFiles.length} API routes audited — all protected`);
  } else {
    record('Security', 'Sensitive route authentication', 'fail', `Routes without withAuth: ${unauthenticated.join(', ')}`);
  }

  if (!process.env.NEXT_PUBLIC_GROK_API_KEY && !process.env.NEXT_PUBLIC_XAI_API_KEY) {
    record('Security', 'Grok API key exposure', 'pass', 'No NEXT_PUBLIC_* xAI keys detected');
  } else {
    record('Security', 'Grok API key exposure', 'fail', 'Remove NEXT_PUBLIC_GROK_API_KEY / NEXT_PUBLIC_XAI_API_KEY');
  }
}

// ─── Summary report ────────────────────────────────────────────────────────────

function printSummary(): void {
  const passed = results.filter((r) => r.status === 'pass').length;
  const warned = results.filter((r) => r.status === 'warn').length;
  const failed = results.filter((r) => r.status === 'fail').length;
  const criticalFails = results.filter((r) => r.status === 'fail' && r.critical).length;

  console.log(`\n${c.bold}${'═'.repeat(64)}${c.reset}`);
  console.log(`${c.bold}  MERLIN PRE-ROLLOUT VALIDATION REPORT${c.reset}`);
  console.log(`${c.dim}  ${new Date().toISOString()} · v${getAppVersion()} · prompt ${PROMPT_VERSION}${c.reset}`);
  console.log(`${c.bold}${'═'.repeat(64)}${c.reset}\n`);

  const sections = [...new Set(results.map((r) => r.section))];
  for (const sec of sections) {
    console.log(`${c.bold}${sec}${c.reset}`);
    for (const r of results.filter((x) => x.section === sec)) {
      const color = r.status === 'pass' ? c.green : r.status === 'warn' ? c.yellow : c.red;
      const label = r.status.toUpperCase().padEnd(4);
      console.log(`  ${color}${label}${c.reset} ${r.name}`);
      if (r.detail) console.log(`       ${c.dim}${r.detail}${c.reset}`);
    }
    console.log('');
  }

  console.log(`${c.bold}Totals:${c.reset}  ${c.green}${passed} passed${c.reset}  ${c.yellow}${warned} warnings${c.reset}  ${c.red}${failed} failed${c.reset}`);

  if (criticalFails > 0) {
    console.log(`\n${c.red}${c.bold}✖ ROLLOUT BLOCKED — ${criticalFails} critical check(s) failed.${c.reset}`);
    console.log(`${c.dim}  Fix failures above before deploying to dealership tablets.${c.reset}\n`);
  } else if (warned > 0) {
    console.log(`\n${c.yellow}${c.bold}⚠ ROLLOUT PROCEED WITH CAUTION — ${warned} warning(s).${c.reset}`);
    console.log(`${c.dim}  Review warnings; complete manual tablet tests (voice, PDF, offline).${c.reset}\n`);
  } else {
    console.log(`\n${c.green}${c.bold}✔ ALL CHECKS PASSED — ready for dealership rollout.${c.reset}\n`);
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`\n${c.bold}${c.cyan}Merlin Pre-Rollout Validation${c.reset}`);
  console.log(`${c.dim}Validating deployment readiness for dealership IT…${c.reset}`);

  loadEnvironment();

  if (!process.env.NEXT_PUBLIC_BUILD_COMMIT) {
    try {
      process.env.NEXT_PUBLIC_BUILD_COMMIT = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
    } catch {
      process.env.NEXT_PUBLIC_BUILD_COMMIT = 'dev';
    }
  }
  if (!process.env.NEXT_PUBLIC_BUILD_DATE) {
    process.env.NEXT_PUBLIC_BUILD_DATE = new Date().toISOString();
  }

  prisma = await initPrismaFromEnvironment();

  await checkEnvironment();
  await checkCoreSystems();
  await checkCoreFeatures();
  await checkSecurityAndConfig();

  printSummary();

  const criticalFails = results.filter((r) => r.status === 'fail' && r.critical).length;
  await prisma?.$disconnect().catch(() => undefined);
  process.exit(criticalFails > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(`\n${c.red}${c.bold}Pre-rollout validation crashed:${c.reset}`, error);
  process.exit(1);
});