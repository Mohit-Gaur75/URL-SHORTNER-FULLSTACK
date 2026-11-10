# Complete API Documentation & Developer Guide

This document provides a comprehensive reference for all REST API endpoints of the **URL Shortener Platform**, including headers, request bodies, query parameters, status codes, and JSON response envelopes.

---

## Base URLs
- **Local Development**: `http://localhost:5000`
- **Docker Compose**: `http://localhost:5000`
- **Public Short Links**: `http://localhost:5000/:code`

---

## Global Headers & Standards

### Standard Request Headers
| Header | Value / Format | Required On | Description |
|---|---|---|---|
| `Content-Type` | `application/json` | All `POST`, `PATCH`, `PUT` requests | Body content encoding |
| `Authorization` | `Bearer <access_token>` | Authenticated endpoints | Stateless JWT session token |
| `X-Requested-With`| `XMLHttpRequest` | Cookie endpoints (`/refresh`, `/logout`) | Custom CSRF defense header |

### Standard Response Headers
All responses from the API include:
- `X-Request-Id`: Unique UUID correlation ID (e.g., `req_8f1b2c3d`) for tracing.
- `Content-Security-Policy`: Modern web defense directives.
- `Strict-Transport-Security`: HSTS policy enforcing HTTPS in production.

---

## Standard Error Response Format

When any request fails, the API responds with a consistent JSON error envelope:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": [
      {
        "field": "originalUrl",
        "message": "originalUrl must be a valid URL with http or https protocol"
      }
    ]
  },
  "requestId": "req_8f1b2c3d"
}
```

### Common Error Codes
| Status Code | Error Code | Meaning |
|---|---|---|
| `400 Bad Request` | `VALIDATION_ERROR` | Schema validation failed on body, query, or path params |
| `400 Bad Request` | `INVALID_JSON` | Malformed JSON in request payload |
| `401 Unauthorized` | `UNAUTHENTICATED` | Missing or invalid Bearer access token |
| `401 Unauthorized` | `TOKEN_EXPIRED` | Access token has expired; client should call `/refresh` |
| `403 Forbidden` | `CSRF_HEADER_REQUIRED` | Missing `X-Requested-With: XMLHttpRequest` header |
| `404 Not Found` | `URL_NOT_FOUND` | Short code does not exist in the database or cache |
| `404 Not Found` | `LINK_DISABLED` | Link owner has disabled this short code |
| `409 Conflict` | `EMAIL_TAKEN` | Account with this email address already exists |
| `409 Conflict` | `SHORT_CODE_TAKEN` | Requested custom code is already owned by someone else |
| `410 Gone` | `LINK_EXPIRED` | Link expiration timestamp (`expiresAt`) has passed |
| `410 Gone` | `LINK_DELETED` | Link has been soft-deleted by its owner |
| `413 Payload Too Large`| `PAYLOAD_TOO_LARGE` | Request body exceeds the 10KB memory limit |
| `429 Too Many Requests`| `RATE_LIMITED` | Rate limit threshold exceeded (inspect `Retry-After` header) |
| `503 Unavailable` | `SERVICE_UNAVAILABLE` | Database or critical downstream service is down or draining |

---

## 1. Health & Probes API

### A. Liveness Probe
Answers whether the Node.js process is active. Used by container orchestrators to decide whether to restart the container.

- **Method**: `GET`
- **Path**: `/api/health/live`
- **Auth**: None
- **Success Status**: `200 OK`

```bash
curl -i http://localhost:5000/api/health/live
```

**Response (200 OK):**
```json
{
  "status": "ok",
  "timestamp": "2026-11-10T17:25:00.000Z",
  "uptimeSeconds": 342
}
```

---

### B. Readiness Probe
Verifies that MongoDB and Redis are actively responding. Used by load balancers to route traffic.

- **Method**: `GET`
- **Path**: `/api/health/ready`
- **Auth**: None
- **Success Status**: `200 OK` (when healthy)
- **Failure Status**: `503 Service Unavailable` (when DB is down or draining)

```bash
curl -i http://localhost:5000/api/health/ready
```

**Response (200 OK):**
```json
{
  "status": "ready",
  "timestamp": "2026-11-10T17:25:00.000Z",
  "checks": {
    "database": {
      "status": "connected",
      "latencyMs": 1.45
    },
    "redis": {
      "status": "connected",
      "latencyMs": 0.52
    }
  }
}
```

---

### C. Diagnostic Health Dashboard
Provides a complete telemetry report of the running instance.

- **Method**: `GET`
- **Path**: `/api/health`
- **Auth**: None
- **Status**: `200 OK` (Reports `"ok"`, `"degraded"`, or `"down"`)

```bash
curl -i http://localhost:5000/api/health
```

**Response (200 OK):**
```json
{
  "status": "ok",
  "timestamp": "2026-11-10T17:25:00.000Z",
  "service": "url-shortener",
  "environment": "production",
  "uptimeSeconds": 342,
  "memory": {
    "rssMb": 45.2,
    "heapUsedMb": 28.4,
    "heapTotalMb": 34.1
  },
  "checks": {
    "database": {
      "status": "connected",
      "latencyMs": 1.45
    },
    "redis": {
      "status": "connected",
      "latencyMs": 0.52
    }
  }
}
```

---

## 2. Authentication API

### A. Register Account
Creates a new user profile, issues a stateless access token, and sets an `HttpOnly` refresh cookie.

- **Method**: `POST`
- **Path**: `/api/auth/register`
- **Headers**: `Content-Type: application/json`

```bash
curl -i -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Alice Engineer",
    "email": "alice@example.com",
    "password": "SuperSecretPassword123!"
  }'
```

**Response (201 Created):**
```http
HTTP/1.1 201 Created
Set-Cookie: refreshToken=ey...; Path=/; HttpOnly; SameSite=Lax
Content-Type: application/json; charset=utf-8

{
  "accessToken": "eyJhbGciOiJIUzI1NiIsIn...",
  "user": {
    "id": "672f7c001a2b3c4d5e6f7a8b",
    "name": "Alice Engineer",
    "email": "alice@example.com"
  }
}
```

---

### B. Login
Authenticates an existing user via password comparison.

- **Method**: `POST`
- **Path**: `/api/auth/login`
- **Headers**: `Content-Type: application/json`

```bash
curl -i -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "password": "SuperSecretPassword123!"
  }'
```

**Response (200 OK):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsIn...",
  "user": {
    "id": "672f7c001a2b3c4d5e6f7a8b",
    "name": "Alice Engineer",
    "email": "alice@example.com"
  }
}
```

---

### C. Get Current Profile
Fetches the profile of the caller using the Bearer token.

- **Method**: `GET`
- **Path**: `/api/auth/me`
- **Headers**: `Authorization: Bearer <accessToken>`

```bash
curl -i http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer <accessToken>"
```

**Response (200 OK):**
```json
{
  "user": {
    "id": "672f7c001a2b3c4d5e6f7a8b",
    "name": "Alice Engineer",
    "email": "alice@example.com"
  }
}
```

---

### D. Rotate Session (Refresh Token)
Exchanges an `HttpOnly` refresh cookie for a fresh access token and rotates the refresh token family.

- **Method**: `POST`
- **Path**: `/api/auth/refresh`
- **Headers**: 
  - `Cookie: refreshToken=<token>`
  - `X-Requested-With: XMLHttpRequest`

```bash
curl -i -X POST http://localhost:5000/api/auth/refresh \
  -H "Cookie: refreshToken=<token>" \
  -H "X-Requested-With: XMLHttpRequest"
```

**Response (200 OK):**
```http
HTTP/1.1 200 OK
Set-Cookie: refreshToken=<newRotatedToken>; Path=/; HttpOnly; SameSite=Lax

{
  "accessToken": "eyJhbGciOiJIUzI1NiIsIn...",
  "user": {
    "id": "672f7c001a2b3c4d5e6f7a8b",
    "name": "Alice Engineer",
    "email": "alice@example.com"
  }
}
```

---

### E. Logout
Revokes the refresh token and deletes the browser cookie.

- **Method**: `POST`
- **Path**: `/api/auth/logout`
- **Headers**:
  - `Cookie: refreshToken=<token>`
  - `X-Requested-With: XMLHttpRequest`

```bash
curl -i -X POST http://localhost:5000/api/auth/logout \
  -H "Cookie: refreshToken=<token>" \
  -H "X-Requested-With: XMLHttpRequest"
```

**Response:** `204 No Content`

---

## 3. URL Management API

### A. Create Short URL
Generates a new short URL. Can be called anonymously or authenticated.

- **Method**: `POST`
- **Path**: `/api/urls`
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <accessToken>` (Optional)

#### Request Body Options:
1. **Random Code**:
   ```json
   {
     "originalUrl": "https://github.com/developer/my-awesome-repo"
   }
   ```
2. **Custom Vanity Alias with Expiration Date**:
   ```json
   {
     "originalUrl": "https://company.com/holiday-sale-2026",
     "customCode": "sale2026",
     "expiresAt": "2026-12-31T23:59:59.000Z"
   }
   ```

```bash
curl -i -X POST http://localhost:5000/api/urls \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <accessToken>" \
  -d '{
    "originalUrl": "https://company.com/holiday-sale-2026",
    "customCode": "sale2026",
    "expiresAt": "2026-12-31T23:59:59.000Z"
  }'
```

**Response (201 Created):**
```json
{
  "id": "672f7c009988776655443322",
  "originalUrl": "https://company.com/holiday-sale-2026",
  "shortCode": "sale2026",
  "shortUrl": "http://localhost:5000/sale2026",
  "isCustomAlias": true,
  "status": "active",
  "clicks": 0,
  "lastClickedAt": null,
  "expiresAt": "2026-12-31T23:59:59.000Z",
  "createdAt": "2026-11-10T17:25:00.000Z",
  "updatedAt": "2026-11-10T17:25:00.000Z",
  "isExpired": false
}
```

---

### B. List User URLs (Dashboard)
Retrieves links created by the authenticated caller with filtering, search, and pagination.

- **Method**: `GET`
- **Path**: `/api/urls`
- **Headers**: `Authorization: Bearer <accessToken>`
- **Query Parameters**:
  - `page`: Page index (default: `1`).
  - `limit`: Number of records per page (default: `10`, max: `100`).
  - `sort`: Sort field (`createdAt`, `clicks`, `lastClickedAt`, `updatedAt`). Default: `createdAt`.
  - `order`: Sort direction (`asc` or `desc`). Default: `desc`.
  - `status`: Filter by state (`active`, `disabled`, `expired`).
  - `search`: Case-insensitive substring match on `shortCode` or `originalUrl`.

```bash
curl -i "http://localhost:5000/api/urls?page=1&limit=10&search=sale" \
  -H "Authorization: Bearer <accessToken>"
```

**Response (200 OK):**
```json
{
  "items": [
    {
      "id": "672f7c009988776655443322",
      "originalUrl": "https://company.com/holiday-sale-2026",
      "shortCode": "sale2026",
      "shortUrl": "http://localhost:5000/sale2026",
      "isCustomAlias": true,
      "status": "active",
      "clicks": 42,
      "lastClickedAt": "2026-11-10T17:28:10.000Z",
      "expiresAt": "2026-12-31T23:59:59.000Z",
      "createdAt": "2026-11-10T17:25:00.000Z",
      "updatedAt": "2026-11-10T17:25:00.000Z",
      "isExpired": false
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  }
}
```

---

### C. Update Short URL
Mutates an existing link. Automatically purges the cached entry in Redis.

- **Method**: `PATCH`
- **Path**: `/api/urls/:id`
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <accessToken>`

```bash
curl -i -X PATCH http://localhost:5000/api/urls/672f7c009988776655443322 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <accessToken>" \
  -d '{
    "originalUrl": "https://company.com/extended-sale-2026",
    "status": "active"
  }'
```

**Response (200 OK):**
```json
{
  "id": "672f7c009988776655443322",
  "originalUrl": "https://company.com/extended-sale-2026",
  "shortCode": "sale2026",
  "shortUrl": "http://localhost:5000/sale2026",
  "isCustomAlias": true,
  "status": "active",
  "clicks": 42,
  "lastClickedAt": "2026-11-10T17:28:10.000Z",
  "expiresAt": "2026-12-31T23:59:59.000Z",
  "createdAt": "2026-11-10T17:25:00.000Z",
  "updatedAt": "2026-11-10T17:30:00.000Z",
  "isExpired": false
}
```

---

### D. Delete Short URL (Soft Delete)
Soft-deletes the short link, clears the Redis cache, and causes subsequent redirects to answer `410 Gone`.

- **Method**: `DELETE`
- **Path**: `/api/urls/:id`
- **Headers**: `Authorization: Bearer <accessToken>`

```bash
curl -i -X DELETE http://localhost:5000/api/urls/672f7c009988776655443322 \
  -H "Authorization: Bearer <accessToken>"
```

**Response:** `204 No Content`

---

## 4. Public Redirection Engine

### Redirect Link
Resolves a public short code and redirects the visitor to the target destination.

- **Method**: `GET`
- **Path**: `/:code`
- **Auth**: None

```bash
curl -i http://localhost:5000/sale2026
```

**Response (302 Found):**
```http
HTTP/1.1 302 Found
Location: https://company.com/extended-sale-2026
Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate
Pragma: no-cache
Expires: 0
X-Request-Id: req_9a8b7c6d
```

#### Inactive Link Responses:
- If expired: `410 Gone` with code `LINK_EXPIRED`.
- If deleted: `410 Gone` with code `LINK_DELETED`.
- If disabled: `404 Not Found` with code `LINK_DISABLED`.
- If nonexistent: `404 Not Found` with code `URL_NOT_FOUND`.
