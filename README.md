# Benz Tech v3 — Dealership Warranty Platform

Professional full-stack Mercedes-Benz warranty documentation platform for authorized dealerships. Technicians scan repair orders, capture XENTRY diagnostic evidence, and generate audit-safe warranty stories — with all data secured on the server.

## What Dealerships Get

- **Server-secured AI** — Grok API runs server-side; credentials never touch technician browsers
- **Encrypted customer PII** — Customer names encrypted at rest (AES-256-GCM); not stored in localStorage
- **Multi-technician accounts** — Per-tech login; managers see all dealership ROs
- **Audit-safe warranty stories** — Facts-only AI prompt with `[NOT DOCUMENTED]` / `[NOT PROVIDED]` placeholders
- **VIN decoder** — NHTSA vPIC auto-fills year, make, model, engine
- **Professional output** — Character counter, formatted clipboard copy, PDF export
- **Compliance** — Mandatory data consent on first login; session-based auth

## Tech Stack

- **Frontend:** Next.js 15, React 19, Tailwind CSS
- **Backend:** Next.js API Routes
- **Database:** Prisma ORM (SQLite dev / PostgreSQL production)
- **Auth:** JWT sessions (httpOnly cookies) + bcrypt passwords
- **AI:** xAI Grok (server-side)
- **OCR:** Tesseract.js (client-side preprocessing — no PII leaves device for OCR)

## Quick Start (Development)

### 1. Clone & install

```bash
git clone https://github.com/Nicequantum/Benz-Tech-v2.git
cd Benz-Tech-v2
git checkout v2.3-dealership
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | `file:./dev.db` for SQLite, or PostgreSQL URL for production |
| `SESSION_SECRET` | Random 32+ char string for session signing |
| `ENCRYPTION_KEY` | 64 hex chars (32 bytes) for PII encryption |
| `GROK_API_KEY` | Your xAI API key from [console.x.ai](https://console.x.ai) |

Generate secrets:

```bash
openssl rand -base64 32   # SESSION_SECRET
openssl rand -hex 32      # ENCRYPTION_KEY
```

### 3. Initialize database

```bash
npm run db:push
npm run db:seed
```

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

**Demo accounts** (created by seed):

| Email | Password | Role |
|-------|----------|------|
| `tech@dealership.com` | `changeme123` | Technician |
| `admin@dealership.com` | `changeme123` | Manager |

## Production Deployment

1. Use **PostgreSQL** — update `DATABASE_URL` and change `provider` in `prisma/schema.prisma` to `postgresql`
2. Set all environment variables on your host (Vercel, Railway, etc.)
3. Run `npx prisma db push` or migrations against production DB
4. Run `npm run db:seed` once to create dealership + admin accounts (or provision via your own process)
5. `npm run build && npm start`

## Project Structure

```
src/
├── app/                  # Next.js App Router + API routes
│   ├── api/
│   │   ├── auth/         # Login, logout, session
│   │   ├── consent/      # Data consent acceptance
│   │   ├── repair-orders/# CRUD, OCR extract, story generation
│   │   └── vin/          # NHTSA VIN decoder
│   ├── layout.tsx
│   └── page.tsx
├── components/           # UI views
├── hooks/                # Client state hooks
├── lib/                  # Server: auth, db, encryption, grok, vin
├── prompts/              # Audit-safe AI prompts
├── services/             # Client OCR (Tesseract)
├── types/
└── utils/
prisma/
├── schema.prisma
└── seed.ts
```

## Workflow

1. **Sign in** with technician credentials
2. **Accept** data & privacy consent (first login)
3. **Scan RO** — add 2–3 page photos → Process All (server-side Grok vision + local OCR fallback)
4. **Review RO** — edit vehicle fields, decode VIN, manage A/B/C complaints
5. **Open repair line** — add XENTRY photos, technician notes, apply reference defaults
6. **Generate story** — server-side Grok with audit-safe prompt
7. **Export** — copy formatted text or download PDF

## Security Notes

- Customer names are encrypted before database storage
- API keys exist only in server environment variables
- Sessions expire after 12 hours
- Technicians only see their own ROs; managers see the full dealership
- Warranty stories never fabricate test data — missing info uses explicit placeholders

## License

Proprietary — for authorized Mercedes-Benz dealership use.