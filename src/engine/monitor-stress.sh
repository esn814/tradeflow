#!/bin/bash
# Monitor the stress test every 30 minutes, write progress to a summary file.
# Runs as a background service alongside the stress test.
LOG="/data/neo/services/stress-test-200.log"
OUT="/workspace/tradeflow/src/engine/stress-monitor.log"
START_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)

echo "Monitor started at $START_TIME" > "$OUT"
echo "Checking every 1800s (30 min)" >> "$OUT"
echo "" >> "$OUT"

CHECK=0
while true; do
  CHECK=$((CHECK + 1))
  NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  
  # Check if the stress test process is still alive
  if ! pgrep -f "run-stress.mjs" > /dev/null 2>&1; then
    echo "" >> "$OUT"
    echo "=== CHECK #$CHECK at $NOW ===" >> "$OUT"
    echo "STATUS: COMPLETED (process exited)" >> "$OUT"
    echo "" >> "$OUT"
    echo "--- FINAL RESULTS ---" >> "$OUT"
    cat /workspace/tradeflow/src/engine/stress-results.txt >> "$OUT" 2>&1
    echo "" >> "$OUT"
    echo "Monitor exiting — test finished." >> "$OUT"
    break
  fi
  
  # Extract latest snapshot from the service log
  LATEST=$(tail -1 "$LOG" 2>/dev/null)
  
  echo "=== CHECK #$CHECK at $NOW ===" >> "$OUT"
  echo "  Process: RUNNING" >> "$OUT"
  echo "  Latest:  $LATEST" >> "$OUT"
  echo "" >> "$OUT"
  
  # Sleep 30 minutes
  sleep 1800
done
