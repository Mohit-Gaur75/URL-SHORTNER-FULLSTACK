# Production Operations & Deployment Runbook

This document serves as the **Operational Runbook** for system administrators, DevOps engineers, and backend developers running the **URL Shortener Platform** in production.

---

## 1. Production Architecture Topology

```text
                                [ Internet Traffic ]
                                         │
                                         ▼
                            [ Cloudflare / AWS WAF ]
                                         │
                                         ▼
                                 [ Ingress / ALB ]
                                  (HTTPS / TLS 1.3)
                                         │
                   ┌─────────────────────┴─────────────────────┐
                   │                                           │
                   ▼ (Port 3000)                               ▼ (Port 5000)
        [ client (Nginx Alpine) ]                    [ api (Node.js 22 Slim) ]
        - Single Page Application                    - Express 5 REST API
        - Gzip & Brotli Assets                       - Pino Structured Logging
        - Non-Root Container                         - Liveness / Readiness Probes
                                                               │
                                       ┌───────────────────────┴───────────────────────┐
                                       │                                               │
                                       ▼ (Port 6379)                                   ▼ (Port 27017)
                           [ redis:7.4-alpine ]                              [ mongo:7.0 ]
                           - Cache-Aside (TTL: 300s)                         - Primary Document Store
                           - Click Buffer (HINCRBY)                          - Compound B-Trees
                           - Distributed Rate Limit                          - Data Volume: /data/db
                                       ▲
                                       │ (BullMQ Job Queue)
                                       ▼
                           [ worker (Node.js 22 Slim) ]
                           - BullMQ Worker Service
                           - Flushes Click Batches every 10s
                           - Atomic bulkWrite() to MongoDB
```

---

## 2. Environment Variables & Production Hardening

Configure the following environment variables in your production environment (e.g. AWS ECS Task Definition, Kubernetes Secret, or Docker Compose `.env`):

```ini
# Core Runtime
NODE_ENV=production
PORT=5000
BASE_URL=https://short.yourdomain.com
CLIENT_URL=https://app.yourdomain.com

# Persistence
MONGO_URI=mongodb+srv://shortener_user:<password>@cluster0.mongodb.net/url-shortener?retryWrites=true&w=majority
REDIS_URL=rediss://default:<password>@redis-cluster.yourdomain.com:6379

# Cryptography & Security
JWT_SECRET=super_strong_cryptographic_secret_key_at_least_64_bytes_long_generated_via_openssl
ACCESS_TOKEN_EXPIRES_IN=15m
REFRESH_TOKEN_DAYS=30
COOKIE_SECURE=true
COOKIE_SAMESITE=lax
TRUST_PROXY=1

# Performance & Background Subsystems
JOBS_MODE=off
CACHE_TTL_SECONDS=300
CLICK_FLUSH_INTERVAL_SECONDS=10
LOG_LEVEL=info
```

> [!IMPORTANT]
> **Generating Cryptographic Secrets**:
> Always generate production `JWT_SECRET` keys using OpenSSL:
> ```bash
> openssl rand -base64 64
> ```

---

## 3. Deployment Procedures

### A. Deploying via Docker Compose

1. **Clone repository on production host**:
   ```bash
   git clone https://github.com/your-org/url-shortener.git
   cd url-shortener
   ```

2. **Configure production secrets**:
   ```bash
   cp server/.env.example .env
   # Edit .env with production credentials
   nano .env
   ```

3. **Build and start containers**:
   ```bash
   docker compose -f docker-compose.yml up --build -d
   ```

4. **Verify container health**:
   ```bash
   docker compose ps
   ```
   All services (`url-shortener-mongo`, `url-shortener-redis`, `url-shortener-api`, `url-shortener-worker`, `url-shortener-client`) must display state `Up` and `healthy`.

---

### B. Zero-Downtime Rolling Update

When releasing a new backend version without dropping active client connections:

```bash
# 1. Pull latest git code
git pull origin main

# 2. Rebuild the API image without stopping running containers
docker compose build api

# 3. Trigger rolling restart of API
docker compose up -d --no-deps --scale api=2 --no-recreate api

# 4. Wait for readiness probes to report healthy (200 OK)
curl -f http://localhost:5000/api/health/ready

# 5. Terminate the old container gracefully
docker compose up -d --no-deps --scale api=1 api
```

---

## 4. Backup & Disaster Recovery

### A. MongoDB Automated Backup

Run `mongodump` against the primary cluster:

```bash
# Create timestamped archive
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
docker exec -t url-shortener-mongo mongodump \
  --uri="mongodb://localhost:27017/url-shortener" \
  --archive="/data/db/backup_${TIMESTAMP}.gz" \
  --gzip

# Copy backup archive to off-site storage (e.g. AWS S3)
aws s3 cp /var/lib/docker/volumes/url-shortener_mongo_data/_data/backup_${TIMESTAMP}.gz \
  s3://your-company-db-backups/mongo/backup_${TIMESTAMP}.gz
```

### B. MongoDB Restore

To restore from a snapshot archive:

```bash
docker exec -i url-shortener-mongo mongorestore \
  --uri="mongodb://localhost:27017/url-shortener" \
  --archive="/data/db/backup_TIMESTAMP.gz" \
  --gzip \
  --drop
```

### C. Redis Persistence (RDB & AOF)
In `docker-compose.yml`, Redis is mounted with a persistent volume (`redis_data:/data`).
To verify Redis persistence:
```bash
docker exec -it url-shortener-redis redis-cli BGSAVE
```

---

## 5. Scaling Strategy

### Scaling the API (Stateless Compute)
Because the Express API is stateless (sessions are verified via JWT and Redis), it scales horizontally behind any layer-7 load balancer (AWS ALB, Nginx, Cloudflare):
```bash
docker compose up -d --scale api=4
```

### Scaling the Worker (Click Buffer Consumer)
BullMQ uses atomic Redis commands (`BRPOPLPUSH` / `RENAME`). You can run multiple worker replicas if click processing latency spikes:
```bash
docker compose up -d --scale worker=2
```

---

## 6. Incident Triage & Emergency Playbooks

### Playbook 1: Spike in HTTP 500 Errors
1. **Check structured error logs**:
   ```bash
   docker logs url-shortener-api --tail 100 | grep '"level":50' | jq
   ```
2. **Inspect database readiness**:
   ```bash
   curl -i http://localhost:5000/api/health/ready
   ```
3. If database ping timed out, check MongoDB CPU and connection pool saturation:
   ```bash
   docker exec -it url-shortener-mongo mongosh --eval "db.serverStatus().connections"
   ```

### Playbook 2: Redis Outage or Eviction Spike
1. **Check Redis Memory and Status**:
   ```bash
   docker exec -it url-shortener-redis redis-cli INFO memory
   ```
2. **Behavior during outage**:
   - The platform **gracefully degrades**: link caching automatically bypasses to MongoDB, and rate limiting falls back to local memory.
   - You do **not** need to restart the API. Once Redis is rebooted, the `ioredis` client automatically reconnects using exponential backoff.

### Playbook 3: Clearing Stale Rate Limits for a Blocked IP
If a customer or monitoring bot is mistakenly blocked:
```bash
# Connect to Redis
docker exec -it url-shortener-redis redis-cli

# Search rate limiter keys
KEYS rl:*

# Delete the specific IP limiter key
DEL "rl:global:192.168.1.50"
```
