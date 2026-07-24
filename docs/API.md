# TradeFlow API Documentation

Base URL: `https://tradeflow-api-i2o1.onrender.com`

## Authentication

TradeFlow uses **SIWE (Sign-In With Ethereum)** for wallet-based authentication.

### Flow

1. **Get a nonce** — `POST /api/auth/nonce`
2. **Sign the SIWE message** client-side with your wallet (EIP-191 `personal_sign`)
3. **Verify** — `POST /api/auth/verify` with `{ message, signature }`
4. Receive a **short-lived JWT** (5 min) in the response body
5. A **refresh token** is set as an `httpOnly` cookie (`tf_rt`, 7-day expiry)
6. **Refresh** before expiry — `POST /api/auth/refresh`

### Using the JWT

Include the token in every authenticated request:

```
Authorization: Bearer <your-jwt-token>
```

### Example: Full Auth Flow

```bash
# 1. Get nonce
curl -X POST https://tradeflow-api-i2o1.onrender.com/api/auth/nonce

# 2. Sign the SIWE message with your wallet (client-side, not shown)

# 3. Verify signature
curl -X POST https://tradeflow-api-i2o1.onrender.com/api/auth/verify \
  -H "Content-Type: application/json" \
  -d '{"message": "<siwe-message>", "signature": "<0x-signature>"}'

# Response: { "token": "eyJ...", "user": { "id": 1, "address": "0x..." }, "address": "0x..." }

# 4. Refresh (cookie is sent automatically)
curl -X POST https://tradeflow-api-i2o1.onrender.com/api/auth/refresh \
  --cookie "tf_rt=<refresh-token>"

# 5. Logout
curl -X POST https://tradeflow-api-i2o1.onrender.com/api/auth/logout
```

---

## Endpoints

### Auth (`/api/auth`)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/api/auth/nonce` | Generate SIWE nonce | No |
| POST | `/api/auth/verify` | Verify SIWE signature, get JWT | No |
| POST | `/api/auth/refresh` | Refresh JWT (uses cookie) | No |
| POST | `/api/auth/logout` | Revoke refresh token | No |

### Trades (`/api/trades`)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/trades` | List trades (`?botId=&limit=100&offset=0`) | Yes |
| GET | `/api/trades/summary` | Trade stats (count, PnL, volume, win rate) | Yes |
| POST | `/api/trades` | Record a trade | Yes |

```bash
# List trades for a specific bot
curl -H "Authorization: Bearer $TOKEN" \
  "https://tradeflow-api-i2o1.onrender.com/api/trades?botId=bot-1&limit=10"

# Get summary stats
curl -H "Authorization: Bearer $TOKEN" \
  https://tradeflow-api-i2o1.onrender.com/api/trades/summary

# Record a trade
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"pair":"BTC/USDT","side":"buy","price":42000,"qty":0.01,"strategy":"trend"}' \
  https://tradeflow-api-i2o1.onrender.com/api/trades
```

### Bots (`/api/bots`)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/bots` | List all bots | Yes |
| POST | `/api/bots` | Create a bot | Yes |
| PUT | `/api/bots/:id` | Update bot (name, status, config) | Yes |
| DELETE | `/api/bots/:id` | Delete bot | Yes |

```bash
# Create a bot
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"BTC Trend Follower","strategy":"trend","pair":"BTC/USDT","risk":"Medium"}' \
  https://tradeflow-api-i2o1.onrender.com/api/bots

# Pause a bot
curl -X PUT -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"paused"}' \
  https://tradeflow-api-i2o1.onrender.com/api/bots/bot-123
```

### Alerts (`/api/alerts`)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/alerts` | List alerts | Yes |
| POST | `/api/alerts` | Create alert | Yes |
| PUT | `/api/alerts/:id` | Update alert | Yes |
| DELETE | `/api/alerts/:id` | Delete alert | Yes |

```bash
# Create a price alert
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"price_above","condition":"BTC/USDT","value":50000}' \
  https://tradeflow-api-i2o1.onrender.com/api/alerts
```

### Schedules (`/api/schedules`)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/schedules` | List scheduled tasks | Yes |
| POST | `/api/schedules` | Create schedule | Yes |
| PUT | `/api/schedules/:id` | Update schedule | Yes |
| DELETE | `/api/schedules/:id` | Delete schedule | Yes |

### Settings (`/api/settings`)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/settings` | Get user settings | Yes |
| PUT | `/api/settings` | Update user settings | Yes |
| GET | `/api/settings/demo-trades` | List demo trades | Yes |
| POST | `/api/settings/demo-trades` | Record a demo trade | Yes |

```bash
# Update risk settings
curl -X PUT -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"maxPositionSize":25,"maxDailyLoss":500,"riskLevel":"high"}' \
  https://tradeflow-api-i2o1.onrender.com/api/settings
```

### Push Notifications (`/api/push`)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/push/vapid-public-key` | Get VAPID public key for Web Push | Yes |
| POST | `/api/push/subscribe` | Subscribe to push notifications | Yes |
| POST | `/api/push/unsubscribe` | Unsubscribe from push | Yes |
| GET | `/api/push/subscriptions` | List active subscriptions | Yes |

```bash
# Get VAPID key
curl -H "Authorization: Bearer $TOKEN" \
  https://tradeflow-api-i2o1.onrender.com/api/push/vapid-public-key

# Subscribe
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"endpoint":"https://fcm.googleapis.com/...","keys":{"p256dh":"...","auth":"..."}}' \
  https://tradeflow-api-i2o1.onrender.com/api/push/subscribe
```

### Copy Trading (`/api/copy-trading`)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/copy-trading` | List followed traders | Yes |
| POST | `/api/copy-trading` | Follow a trader | Yes |
| PUT | `/api/copy-trading/:id` | Update follow settings | Yes |
| DELETE | `/api/copy-trading/:id` | Unfollow a trader | Yes |
| GET | `/api/copy-trading/history` | Copy trade history (`?limit=50`) | Yes |
| POST | `/api/copy-trading/history` | Record a copy trade | Yes |

### Social (`/api/social`)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/social/leaderboard` | Trader leaderboard (`?limit=20`) | No |
| GET | `/api/social/strategies` | Published strategies (`?sort=popular&limit=20&offset=0`) | No |
| GET | `/api/social/strategies/my` | My published strategies | Yes |
| POST | `/api/social/strategies` | Publish a strategy | Yes |
| GET | `/api/social/strategies/:id` | Strategy details | No |
| PUT | `/api/social/strategies/:id` | Update strategy | Yes |
| DELETE | `/api/social/strategies/:id` | Delete strategy | Yes |
| POST | `/api/social/strategies/:id/like` | Like a strategy | Yes |
| POST | `/api/social/strategies/:id/fork` | Fork a strategy | Yes |

```bash
# Get leaderboard (public, no auth)
curl https://tradeflow-api-i2o1.onrender.com/api/social/leaderboard?limit=10

# List popular strategies (public)
curl "https://tradeflow-api-i2o1.onrender.com/api/social/strategies?sort=popular&limit=10"

# Publish a strategy
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Momentum Alpha","description":"RSI + MACD trend following","strategy_type":"trend","params":{"rsi_threshold":30}}' \
  https://tradeflow-api-i2o1.onrender.com/api/social/strategies/my
```

---

## Error Handling

All errors return a consistent JSON shape:

```json
{ "error": "Human-readable error message" }
```

| Status | Meaning |
|--------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad request / invalid input |
| 401 | Missing or invalid JWT (re-authenticate) |
| 404 | Resource not found |
| 429 | Rate limited (too many nonces) |
| 500 | Internal server error |

### JWT Expiry

- **Access token**: 5 minutes
- **Refresh token**: 7 days (httpOnly cookie `tf_rt`)
- On 401, call `POST /api/auth/refresh` (cookie sent automatically) to get a new JWT

---

## OpenAPI Spec

A machine-readable OpenAPI 3.0 specification is available at:

[`docs/openapi.yaml`](./openapi.yaml)

Import it into Swagger UI, Postman, or any OpenAPI-compatible tool for interactive exploration and code generation.

---

*Last updated: 2026-07-24 · 42 operations across 9 resource groups*
