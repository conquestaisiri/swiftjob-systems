# SwiftJob - Global Workforce Platform

A full-stack monorepo for a global workforce platform connecting businesses with remote professionals.

## Architecture

```
├── lib/                          # Shared libraries
│   ├── api-spec/                 # OpenAPI 3.1 spec + Orval config
│   ├── api-zod/                  # Zod schemas generated from OpenAPI
│   ├── api-client-react/         # React Query hooks + typed fetch client
│   └── db/                       # Drizzle ORM schema (PostgreSQL)
│
├── artifacts/                    # Applications
│   ├── api-server/               # Express API (Node.js + TypeScript)
│   ├── swiftjob-systems/         # React 19 + Vite + Tailwind 4 frontend
│   └── mockup-sandbox/           # Design system preview
│
├── scripts/                      # Utility scripts
└── .github/workflows/            # CI/CD pipelines
```

## Tech Stack

| Layer               | Technology                               |
| ------------------- | ---------------------------------------- |
| **Language**        | TypeScript (strict)                      |
| **Package Manager** | pnpm 9 (workspace)                       |
| **Database**        | PostgreSQL (Neon/Supabase) + Drizzle ORM |
| **API**             | Express 5 + Zod validation               |
| **Frontend**        | React 19 + Vite 7 + Tailwind 4           |
| **State/Data**      | TanStack Query + Wouter router           |
| **Auth**            | JWT (admin)                              |
| **Email**           | Resend                                   |
| **File Storage**    | Cloudflare R2 (S3-compatible)            |
| **Logging**         | Pino                                     |
| **CI/CD**           | GitHub Actions                           |

## Features

- **Careers Portal**: 14 job listings with filtering, search, pagination
- **Application Forms**: 19 required fields + resume upload (PDF/DOC/DOCX ≤10MB)
- **Email Notifications**:
  - Applicant confirmation email
  - HR notification with full application details
  - Status update emails (Reviewing → Shortlisted → Rejected/Hired)
- **Admin Dashboard**:
  - Paginated application table with search/filter
  - Status management with dropdown
  - Application detail modal with resume download
  - Statistics overview
- **File Storage**: Resumes stored in Cloudflare R2 with presigned URLs
- **Type Safety**: End-to-end typed (OpenAPI → Orval → Zod → React Query)
- **Security**: Rate limiting, Helmet, CORS, JWT auth, input validation

## Quick Start

### Prerequisites

- Node.js 22+
- pnpm 9+
- PostgreSQL database (Neon, Supabase, or local)
- Resend account (for emails)
- Cloudflare R2 account (for file storage)

### 1. Clone and Install

```bash
git clone <repo-url>
cd swiftjob-systems
pnpm install
```

### 2. Environment Setup

Create `.env` files in each artifact:

**artifacts/api-server/.env**

```env
# Database (create free project at https://supabase.com)
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres"

# Resend (get from https://resend.com)
RESEND_API_KEY="re_..."
EMAIL_FROM="SwiftJob <careers@swiftjob.payservice.top>"
HR_EMAIL="hr@swiftjob.payservice.top"

# Cloudflare R2 (get from Cloudflare Dashboard → R2)
R2_ACCOUNT_ID="..."
R2_ACCESS_KEY_ID="..."
R2_SECRET_ACCESS_KEY="..."
R2_BUCKET="swiftjobsystems"
R2_ENDPOINT="https://<account-id>.r2.cloudflarestorage.com"
R2_PUBLIC_URL="https://pub-<account-id>.r2.dev"

# Auth
JWT_SECRET="generate-with: openssl rand -base64 32"
ADMIN_EMAIL="admin@swiftjob.payservice.top"
ADMIN_PASSWORD="secure-password-here"

# App
NODE_ENV="development"
PORT="3001"
FRONTEND_URL="http://localhost:5173"
```

**artifacts/swiftjob-systems/.env**

```env
VITE_API_URL="http://localhost:3001/api"
```

### 3. Database Setup

```bash
# Push schema to database
cd artifacts/api-server
pnpm run db:push

# Or use Drizzle Studio to inspect
pnpm run db:studio
```

### 4. Development

```bash
# Terminal 1: API Server
cd artifacts/api-server
pnpm run dev

# Terminal 2: Frontend
cd artifacts/swiftjob-systems
pnpm run dev
```

Visit:

- Frontend: http://localhost:5173
- API: http://localhost:3001/api/healthz
- Admin: http://localhost:5173/admin

### 5. Production Build

```bash
# Build all packages
pnpm run build

# Typecheck all
pnpm run typecheck
```

## Project Structure Details

### Shared Libraries

**lib/db** - Database schema and client

- `src/schema/applications.ts` - Applications table with full field definitions
- `src/index.ts` - Drizzle client + pool export

**lib/api-zod** - Zod validation schemas

- Generated from OpenAPI spec via Orval
- Used by both frontend and backend

**lib/api-client-react** - React Query integration

- `custom-fetch.ts` - Typed fetch with auth, base URL, error handling
- Generated hooks in `src/generated/api.ts`

### API Server (artifacts/api-server)

```
src/
├── routes/
│   ├── health.ts           # GET /healthz
│   ├── applications.ts     # POST/GET /applications
│   ├── admin.ts            # Admin CRUD + stats
│   └── auth.ts             # Admin login
├── services/
│   ├── applicationService.ts  # Business logic + email orchestration
│   ├── storageService.ts      # R2 upload/delete/presigned URLs
│   └── emailService.ts        # Resend templates + sending
├── repositories/
│   └── applicationRepository.ts  # Drizzle queries
├── middleware/
│   ├── auth.ts            # JWT verification
│   └── upload.ts          # Multer memory storage
├── models/
│   └── application.ts     # Type exports
├── lib/
│   └── logger.ts          # Pino logger
├── app.ts                 # Express setup + middleware
└── index.ts               # Entry point
```

### Frontend (artifacts/swiftjob-systems)

```
src/
├── pages/
│   ├── Home.tsx           # Landing page
│   ├── CareersPage.tsx    # Job listings with filters
│   ├── JobPage.tsx        # Job detail + application form
│   ├── ApplicationSuccess.tsx  # Success page
│   └── Admin/
│       └── AdminDashboard.tsx  # Admin panel
├── components/
│   ├── site/
│   │   └── SiteLayout.tsx # Shared layout with nav/footer
│   └── ui/                # Radix-based UI components
├── data/
│   └── jobs.ts            # 14 job definitions
├── hooks/
│   ├── use-mobile.tsx
│   └── use-toast.ts
├── lib/
│   └── utils.ts
├── App.tsx                # Routes + providers
└── main.tsx               # Entry point
```

## API Endpoints

### Public

| Method | Endpoint                | Description                    |
| ------ | ----------------------- | ------------------------------ |
| GET    | `/api/healthz`          | Health check                   |
| POST   | `/api/applications`     | Submit application (multipart) |
| GET    | `/api/applications`     | List all (admin only)          |
| GET    | `/api/applications/:id` | Get single (admin only)        |

### Admin (requires JWT)

| Method | Endpoint                             | Description                 |
| ------ | ------------------------------------ | --------------------------- |
| POST   | `/api/admin/login`                   | Admin login                 |
| GET    | `/api/admin/applications`            | Paginated list with filters |
| GET    | `/api/admin/applications/:id`        | Get application details     |
| PATCH  | `/api/admin/applications/:id/status` | Update status               |
| GET    | `/api/admin/stats`                   | Statistics                  |
| GET    | `/api/admin/applications/:id/resume` | Download resume             |

## Email Templates

Located in `artifacts/api-server/src/services/emailService.ts`:

1. **HR Notification** - Full application details in formatted HTML table
2. **Applicant Confirmation** - Branded confirmation with next steps
3. **Status Update** - Dynamic based on status (Reviewing/Shortlisted/Rejected/Hired)

## File Upload Flow

1. Client uploads resume via multipart form
2. Server validates (type, size) in middleware
3. Service uploads to R2 with unique key: `resumes/{timestamp}-{uuid}.{ext}`
4. Application record stores R2 key + original filename
5. Admin can download via presigned URL (1-hour expiry)

## Deployment

### Recommended Free Tier Stack

| Service     | Provider                            | Free Tier                             |
| ----------- | ----------------------------------- | ------------------------------------- |
| Database    | Supabase / Neon                     | 500MB / 0.5GB Postgres                |
| API Hosting | Render / Railway / Fly.io           | 750 hrs/mo / $5 credit / 3 shared VMs |
| Frontend    | Vercel / Netlify / Cloudflare Pages | Unlimited personal                    |
| Email       | Resend                              | 3,000 emails/month                    |
| Storage     | Cloudflare R2                       | 10 GB/month                           |

### Environment Variables for Production

Add to your hosting platform:

- All variables from `.env` example
- `NODE_ENV=production`
- `FRONTEND_URL=https://yourdomain.com`

### Database Migrations

```bash
# On deployment
pnpm --filter @workspace/api-server run db:push
```

## Development Commands

```bash
# Install dependencies
pnpm install

# Typecheck everything
pnpm run typecheck

# Build all packages
pnpm run build

# Database operations
cd artifacts/api-server
pnpm run db:push      # Push schema changes
pnpm run db:studio    # Open Drizzle Studio

# Frontend
cd artifacts/swiftjob-systems
pnpm run dev          # Dev server
pnpm run build        # Production build
pnpm run serve        # Preview build

# API Server
cd artifacts/api-server
pnpm run dev          # Dev with auto-rebuild
pnpm run build        # esbuild bundle
pnpm run start        # Run built server
```

## Security Considerations

- **Rate Limiting**: 100 req/15min general, 10/hr on applications
- **Helmet**: Security headers
- **CORS**: Configured for frontend origin
- **JWT**: 7-day expiry, HS256
- **Validation**: Zod schemas on all inputs
- **File Upload**: Type + size validation, memory storage (no disk)
- **Secrets**: Never committed, use environment variables

## Contributing

1. Create feature branch
2. Make changes with tests
3. Run `pnpm run typecheck` and `pnpm run build`
4. Submit PR

## License

MIT
