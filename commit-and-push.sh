#!/bin/bash
set -e
cd /data/workspace/tradeflow

# Stage everything
git add -A

# Commit
GIT_AUTHOR_NAME="Morpheus" GIT_AUTHOR_EMAIL="morpheus@matrix.agent" \
GIT_COMMITTER_NAME="Morpheus" GIT_COMMITTER_EMAIL="morpheus@matrix.agent" \
git commit -m "feat: wire real market data + unified strategy registry

Phase 2 complete:
- Dashboard: useLiveStream + fetchCandles + useWalletPortfolio
- Backtester: fetchCandles with generateOHLCV fallback only
- RiskManager: real ATR, Kelly, drawdown, position sizing from live candles
- New: src/strategies/index.js (unified strategy registry, 10 strategies)
- New: src/hooks/useSimulation.js (engine-backed sim with localStorage)
- Updated: TODOLIST with Phase 2 completion
- Removed: dist/ from tracking, autopilotData.js dead code"

# Push
git push origin master

echo "DONE: committed and pushed successfully"
