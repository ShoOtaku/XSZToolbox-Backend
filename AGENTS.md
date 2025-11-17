# Repository Guidelines

## Project Structure & Modules
- Backend entry: `src/app.js` (Express server, middleware setup).
- Business logic in `src/controllers`, DB access in `src/models`, routing in `src/routes`.
- Cross‑cutting utilities live in `src/middleware` (security, auth, logging) and `src/utils` (crypto, logger).
- SQLite data is under `database/` (gitignored); logs are written to `logs/`.
- `admin-panel/` hosts the static admin UI served by the backend.

## Build, Run, and Development
- Install dependencies: `npm install`.
- Start in production mode: `npm start` (uses `src/app.js`).
- Start in development: `npm run dev` (nodemon auto‑reload).
- Initialize/reset DB: `npm run init-db` (runs `src/scripts/initDatabase.js`).
- Docker: `docker-compose up -d` or `docker-compose --profile with-nginx up -d`.

## Coding Style & Naming
- Language: Node.js with CommonJS modules; target Node 18+.
- Use 2‑space indentation, single quotes for strings, and `const`/`let` (no `var`).
- File naming: `camelCase.js` for utilities, `*Model.js`, `*Controller.js`, `*.middleware.js`.
- Prefer small, pure functions; keep controllers thin and move DB logic into models.

## Testing Guidelines
- No formal test suite yet; `npm test` currently exits with an error.
- Use `test-verify.js` and manual calls (curl/Postman) for endpoint testing.
- When adding tests, colocate them under `test/` (e.g., `test/admin.login.spec.js`) and wire a real `npm test` command.

## Commit & PR Practices
- Follow clear, imperative commit messages: `fix auth token expiry`, `add whitelist export route`.
- One logical change per commit; keep diffs focused and small.
- PRs should include: purpose summary, key changes, manual test notes, and any security impact.
- Link related issues or TODOs in the PR description, and highlight breaking API changes explicitly.
