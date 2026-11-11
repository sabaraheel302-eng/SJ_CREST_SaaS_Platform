# CellOn Mobile Shop SaaS

Multi-tenant mobile shop management SaaS. The public marketing site, platform admin approval workflow, shop authentication, account activation, and PostgreSQL/Prisma foundation are built with Next.js App Router, React, TypeScript, Tailwind CSS and Zod.

## Requirements

- Node.js 22.12 or later (Node 24 recommended)
- PostgreSQL 14 or later

## Local development

1. Copy `.env.example` to `.env`, set `DATABASE_URL`, and configure SMTP. Set a unique `ADMIN_EMAIL` and strong `ADMIN_PASSWORD` for the initial Super Admin seed.
2. Install dependencies with `npm install`.
3. Generate the Prisma client with `npm run db:generate` (Prisma 7 uses the `prisma.config.ts` datasource configuration and PostgreSQL driver adapter).
4. Create and apply the initial migration with `npm run db:migrate -- --name init`.
5. Seed Basic, Plus and Pro plan limits and create the initial Super Admin with `npm run db:seed`. Seed does not overwrite a Super Admin password on later runs.
6. Start the site with `npm run dev` and open `http://localhost:3000`.

## Public routes and data

- Public pages: `/`, `/product`, `/features`, `/pricing`, `/about`, `/contact`, `/demo`, `/request-account`, and `/login`.
- `POST /api/account-requests` validates and records an account request. An open request for the same email is rejected as a duplicate. It does not create a tenant or user account.
- `POST /api/demo-requests` validates and records a demo request.
- Both workflows add a persisted admin notification record in the same transaction as the request.
- Homepage hero heading and description are read from published `WebsiteContent` when available, with a safe fallback. Seed creates the initial published copy. The schema supports versioned draft/published CMS entries; editor, preview, and publishing controls are later admin-phase work.
- `/login` provides customer sign-in; `/admin/login` is the separate platform administrator sign-in.

## Account lifecycle and authentication

- `/admin/login` uses a database user with the `SUPER_ADMIN` platform role. Create the first one through the protected seed process; there is no public admin registration.
- Admin sessions use opaque random cookies, store only SHA-256 token digests in PostgreSQL, expire after eight hours, and can be revoked on logout. Passwords use Argon2id.
- The admin request queue supports status search, review notes, rejection, plan and term assignment, branch/employee limit checks, tenant and branch provisioning, a database-unique `CLN-` serial, and account activation invites.
- Activation links contain a random one-time token. Only its digest is stored; links expire after 24 hours and are consumed once. Account activation enables the tenant and starts its subscription term.
- The app sends invitation/rejection email through SMTP. If SMTP is unavailable, approval remains pending activation and the admin can resend an invite after fixing SMTP.
- Customer login requires an active user, active tenant, and current subscription. A serial number is an identifier only and cannot authenticate.
- Login, activation, and public request endpoints use persistent PostgreSQL rate-limit buckets. Cookie-authenticated writes check same-origin requests and use `SameSite=Strict` cookies.
- `/app` is protected server-side and shows only the signed-in tenant's actual business, serial, and subscription details. A shared `requireShopAccess` guard resolves tenant, branch, permission, and subscription access for future shop API routes.

## Inventory and IMEI

- `/app/products` lists the signed-in shop's active products and actual stock counts. Product create, edit, and archive actions are backed by tenant-scoped APIs and permission checks.
- Products support shop-unique SKUs, cost/sale prices, optional IMEI tracking, and archival. Stocked products cannot be archived, and products with IMEI history cannot have tracking disabled.
- IMEI tracked products can receive devices into an active shop branch. Intake validates IMEI checksums and batch duplicates, stores primary/secondary identifiers under global unique constraints, and records a stock movement and audit event in one transaction.
- Product and IMEI writes serialize on the tenant row before checking plan limits. Reads and writes are tenant scoped; employee branch membership filters inventory access. IMEI endpoints also require the plan's `imei` feature.

## Database notes

`prisma/schema.prisma` defines the initial platform and shop-domain model, with UUID keys, foreign keys, status enums, tenant IDs, unique business identifiers, timestamps, and query indexes. Tenant-owned rows include `tenantId`. Enforcing tenant ownership on writes and compound references, PostgreSQL row-level security, migrations, and tenant-isolation tests are required before shop data routes are exposed; the schema alone does not provide an authorization boundary.

The schema covers account/demo requests, tenants, users and role permissions, plans/features/subscriptions, unique shop serials, branches, products and IMEIs, customers/suppliers, sales/purchase records, payments, expenses, stock movements, audit logs, support, notifications, and website content.

## Checks and test scope

- `npm test` runs unit tests for serial generation, token digesting, Argon2id hashing, password and payload validation, tenant/branch/plan access decisions, IMEI checksum and intake validation, and subscription date boundaries.
- `npm run typecheck` and `npm run build` check the app and server routes.
- Database-backed approval, login/session revocation, activation, and cross-tenant query integration tests must run against a dedicated test PostgreSQL database before production use. Do not point test or migration commands at a production database.

## Remaining phases

1. Purchases, POS/sales, customers and suppliers using transaction-safe operations.
2. Reports, subscription management, employee and branch permissions, session revocation and account lifecycle controls.
3. PostgreSQL RLS, full tenant-isolation/API integration tests, operational email retries, backups, monitoring and pilot deployment.

Do not use the current foundation for production customer records until the later authorization, migration, and test work is complete.
