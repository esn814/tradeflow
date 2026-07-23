# TradeFlow Monitoring Setup

## Uptime Monitoring (UptimeRobot — Free Tier)

1. Create an account at https://uptimerobot.com
2. Add a new monitor:
   - **Type:** HTTP(s)
   - **URL:** `https://tradeflow-api-i2o1.onrender.com/api/health`
   - **Interval:** 5 minutes
   - **Name:** TradeFlow API
3. Add alert contacts (email, Slack, Telegram)
4. The health endpoint returns `{"ok": true}` when healthy, `503` when not

## Error Tracking (Sentry — Optional)

### Frontend
Already configured in `src/main.jsx`. Set `VITE_SENTRY_DSN` in `.env`.

### Backend
TODO: Add `@sentry/node` to the Express server. See Step 2 of the improvement roadmap.

## Logs (Render Dashboard)

Render captures stdout/stderr automatically:
- Dashboard → Service → Logs tab
- Filter by time range
- Structured logging (pino) planned in Step 2 of the improvement roadmap

## Database Backups

Automated daily via `VACUUM INTO`:
- Stored on Render persistent disk at `/app/data/backups/`
- 7-day retention (configurable via `BACKUP_RETENTION_DAYS` env var)
- List backups: `GET /api/backup` (auth required)
- Trigger manual backup: `POST /api/backup` (auth required)
