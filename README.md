# Modern 2026 Blog Engine & Platform REST API

A production-grade, highly scalable Express 5 & TypeScript REST API for modern publishing platforms. Built with JWT authentication, Redis-backed rate limiting and token revocation, Prisma ORM with SQLite, Gmail SMTP with OTP verification, Cloudinary media optimization via Sharp (<= 250KB WebP), Swagger UI & ReDoc documentation, RSS/JSON/Sitemap feeds, Server-Sent Events (SSE) real-time notifications, Webhooks with HMAC SHA-256 signatures, and 100% test coverage with Jest.

---

## 🌟 Features

- **Express 5 + Native ESM**: Native ECMAScript Modules (`"type": "module"`, `"module": "NodeNext"`).
- **Prisma ORM & SQLite**: Type-safe relational database with indexing, soft-deletes, and cascade rules.
- **JWT Authentication & Security**:
  - Access Tokens (15m) + Refresh Tokens (7d) with Redis-based multi-session revocation.
  - Email Verification via 6-digit numeric OTP with rate limiting (max 3/hr).
  - Password Reset & Change Password workflows.
  - Role-Based Access Control (`READER`, `AUTHOR`, `ADMIN`).
  - Strict security headers via Helmet and CORS.
- **Publishing & Content Management**:
  - Full CRUD with cursor-based pagination and sorting (`newest`, `oldest`, `popular`).
  - Markdown to sanitized HTML rendering (`marked` + `xss`).
  - Reading time and word count calculation (`reading-time`).
  - Table of contents extraction and automatic slug generation with collision resistance.
  - Revision history and version rollbacks.
  - Scheduled publishing via background cron jobs.
- **Taxonomy & Media**:
  - Hierarchical Categories (adjacency tree) and Tags.
  - Media uploads with Sharp WebP image compression ($\le 250\text{ KB}$) and Cloudinary CDN storage.
- **Engagement & Social**:
  - Nested, threaded comments with moderation/editing.
  - Multi-type reactions (`LIKE`, `CLAP`, `LOVE`, `INSIGHTFUL`, `CELEBRATE`).
  - Bookmarks & Author follow system.
- **Search, Analytics & SEO**:
  - Full-text SQLite search across posts, categories, tags, and authors.
  - Privacy-first view tracking (visitor hashing), read completion percentages, author dashboards, and Redis daily trending leaderboards.
  - RSS 2.0 (`/feed.xml`), JSON Feed 1.1 (`/feed.json`), XML Sitemap (`/sitemap.xml`), and JSON-LD structured data.
- **Real-time Notifications & Integrations**:
  - Real-time Server-Sent Events (SSE) notifications stream (`/api/notifications/stream`).
  - Newsletter subscriptions with double opt-in confirmation tokens.
  - Outgoing Webhooks with HMAC SHA-256 signature verification.
- **API Documentation & Health Probes**:
  - Interactive ReDoc UI at root `/`.
  - Swagger 3.0 UI explorer at `/docs`.
  - Deep liveness and readiness health checks at `/api/health` probing SQLite and Redis.
- **Testing**:
  - 100% test coverage with 145+ tests using Jest, ts-jest, and Supertest.
- **Production Containerization**:
  - Multi-stage ultra-lightweight Alpine Linux `Dockerfile` (`node:22-alpine`).
  - Production `docker-compose.yml` with isolated network, persistent SQLite & Redis volumes, and container health checks.

---

## 🐳 Docker Quickstart

To run the complete platform (API + Redis) in isolated Alpine containers:

```bash
# 1. Copy environment template
cp .env.example .env

# 2. Start services with Docker Compose
docker compose up --build -d

# 3. Check service health
curl http://localhost:8000/api/health
```

The application is immediately available at:
- **Interactive ReDoc**: [http://localhost:8000/](http://localhost:8000/)
- **Swagger UI Explorer**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Health Check**: [http://localhost:8000/api/health](http://localhost:8000/api/health)
- **RSS Feed**: [http://localhost:8000/feed.xml](http://localhost:8000/feed.xml)
- **Sitemap**: [http://localhost:8000/sitemap.xml](http://localhost:8000/sitemap.xml)

To stop the containers:
```bash
docker compose down
```

---

## 💻 Local Development Setup

### 1. Prerequisites
- **Node.js**: `v20.0.0` or higher
- **Redis**: Running locally at `redis://localhost:6379` (or via `docker run -d -p 6379:6379 redis:7-alpine`)

### 2. Installation
```bash
npm install
```

### 3. Database Setup
```bash
npx prisma db push
```

### 4. Running the Dev Server
```bash
npm run dev
```

### 5. Production Build
```bash
npm run build
npm start
```

---

## 🧪 Testing & Code Coverage

```bash
# Run all unit and integration tests
npm test

# Run tests with 100% coverage verification
npm run test:coverage
```

