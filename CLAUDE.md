# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

XSZToolbox Backend is a Node.js/Express backend service for FFXIV Dalamud plugin user verification and data collection. It provides user authentication via CID (Content ID) hashing, whitelist management, and an admin panel for managing authorized users.

## Development Commands

### Starting the Server
```bash
# Production mode
npm start

# Development mode with auto-reload
npm run dev

# Initialize/reset database
npm run init-db
```

### Environment Setup
Copy `.env.example` to `.env` and configure:
- `JWT_SECRET` - Must be changed in production
- `HMAC_SECRET` - Must match frontend plugin
- `HASH_SALT` - Must match frontend plugin (default: `XSZToolbox_CID_Salt_2025`)
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` - Default admin credentials (admin/admin123)
- `ADMIN_CID_HASHES` - Legacy: comma-separated CID hashes for admin access

### Docker Deployment
```bash
# Start backend only
docker-compose up -d

# Start with nginx reverse proxy
docker-compose --profile with-nginx up -d

# View logs
docker-compose logs -f xsztoolbox-backend
```

## Architecture

### Core Security Flow
1. **CID Hashing**: Frontend sends hashed CID using SHA256(`HASH_SALT` + ContentID)
2. **HMAC Signatures** (Optional): POST requests can include X-Timestamp and X-Signature headers for replay attack prevention
3. **JWT Authentication**: Admin endpoints require Bearer token authentication
4. **Whitelist Authorization**: User verification checks against whitelist table

### Database Schema (SQLite with better-sqlite3)
- **users**: Tracks all user submissions (cid_hash, character_name, world_name, qq_info, login counts)
- **whitelist**: Authorized users (cid_hash, note, permissions JSON, expires_at)
- **admins**: Admin accounts (supports both username/password and legacy CID-based auth)
- **audit_logs**: Action logging (cid_hash, action, ip_address, details)

All tables use `cid_hash` as the primary identifier. The database uses WAL mode for better concurrency.

### Middleware Stack (Applied in Order)
1. **Helmet** - Security headers
2. **CORS** - Cross-origin configuration
3. **JSON parsing** - Body parser (10mb limit)
4. **Request logger** - Winston-based audit logging
5. **HTTPS enforcement** - Checks `req.secure` or `x-forwarded-proto` header (skipped in dev)
6. **Rate limiting** - Configurable via `ENABLE_RATE_LIMIT`
7. **Signature verification** - HMAC validation for POST requests (optional)

### Key Route Groups
- `/api/submit` (POST) - User data submission (supports both plaintext CID + hash or hash-only)
- `/api/verify/:hash` (GET) - Check if CID hash is whitelisted
- `/api/whitelist` (GET) - Public GitHub-format whitelist export
- `/api/admin/login` (POST) - Admin authentication (username/password or CID hash)
- `/api/admin/*` - Protected admin endpoints (require JWT)

### Important Implementation Details

**CID Hash Compatibility**: The system supports two modes:
- New: Client sends both `plainCid` (raw CID) and `cid` (hash) - server verifies hash matches
- Legacy: Client sends only `cid` (hash)

**Admin Authentication**: Dual-mode support:
- Primary: Username/password authentication (bcrypt hashed)
- Legacy: CID hash-based authentication via `ADMIN_CID_HASHES` env var

**Whitelist Permissions**: Stored as JSON array in `permissions` column (e.g., `["all"]`, `["feature1", "feature2"]`)

**Database Migrations**: `migrateDatabase()` in `src/models/database.js` handles schema evolution automatically on startup

## Common Patterns

### Adding New Admin Endpoints
1. Add route in `src/routes/admin.js` after `router.use(verifyToken)`
2. Add controller method in `src/controllers/adminController.js`
3. Use `auditLog('action_name')` middleware for tracking
4. Access admin info via `req.admin.username` or `req.admin.cidHash`

### Working with Database Models
Models are instantiated with the db instance:
```javascript
const db = dbManager.getDb();
const userModel = new UserModel(db);
const result = userModel.upsertUser({ ... });
```

All models use prepared statements for SQL injection prevention. Use transactions for multi-statement operations.

### Logging Conventions
- Use `logger.info` for successful operations
- Use `logger.warn` for validation failures or security issues
- Use `logger.error` for exceptions and server errors
- Include relevant identifiers (CID hash, username) in log messages

### Security Considerations
- Never log plaintext CIDs - always use hashed versions
- CID hashes are case-insensitive (stored in UPPERCASE)
- HMAC signature verification uses timing-safe comparison
- Bcrypt salt rounds: 10 (defined in `database.js:229`)
- JWT tokens expire after `JWT_EXPIRES_IN` (default: 24h)

## File Organization

- `src/app.js` - Main entry point, middleware configuration, server startup
- `src/models/database.js` - DatabaseManager singleton, table initialization, migrations
- `src/models/*Model.js` - Data access layer (users, whitelist, admins, audit logs)
- `src/controllers/` - Request handlers
- `src/routes/` - Route definitions (api.js for public, admin.js for protected)
- `src/middleware/` - Custom middleware (auth, security, rate limiting, audit)
- `src/utils/` - Shared utilities (crypto, logger)
- `admin-panel/` - Static HTML/CSS/JS admin interface
- `database/` - SQLite database file (gitignored)
- `logs/` - Winston log files (gitignored)

## Special Scripts

- `fix-whitelist-hashes.js` - Utility to rehash whitelist entries if HASH_SALT changes
- `test-verify.js` - Manual testing script for verification endpoint
- `src/scripts/initDatabase.js` - Standalone database initialization

## Testing Notes

No automated tests are currently configured (`package.json:10` shows test script exits with error). Manual testing is done via:
- Curl/Postman for API endpoints
- Admin panel UI at `/admin`
- Health check endpoint: `/api/health`
