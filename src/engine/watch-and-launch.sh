#!/bin/bash
# Watch v3 stress test (pid 575), launch pressure test when it exits.
cd /workspace/tradeflow

LOG="/workspace/tradeflow/src/engine/run-log.txt"
echo "[$(date -u +%H:%M:%S)] Watcher started. Monitoring v3 test (pid 575)..." | tee "$LOG"

# Poll every 30 seconds
while kill -0 575 2>/dev/null; do
  sleep 30
done

echo "" | tee -a "$LOG"
echo "[$(date -u +%H:%M:%S)] ═══ V3 TEST FINISHED ═══" | tee -a "$LOG"
echo "" | tee -a "$LOG"

# Launch pressure test
echo "[$(date -u +%H:%M:%S)] Launching pressure test (1000 bots × 3 engines × 50ms tick)..." | tee -a "$LOG"
node src/engine/run-pressure.mjs 2>&1 | tee -a "$LOG"

echo "" | tee -a "$LOG"
echo "[$(date -u +%H:%M:%S)] ═══ PRESSURE TEST FINISHED ═══" | tee -a "$LOG"
