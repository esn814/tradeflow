# Codify Integration Guide for TradeFlow

## Quick Start

### 1. Install Codify (Linux x86_64)

```bash
curl -fsSL https://codify.centra.ag/install | bash
```

Or build from source:
```bash
git clone https://github.com/Sidiora-Labs/codify.git
cd codify
make && sudo make install
```

### 2. Initialize Code Graph

```bash
cd tradeflow
cg init
```

This creates `.codegraph/` with:
- `graph.db` — SQLite database with symbols, call edges, routes
- `objects/` — content-addressed snapshot storage

### 3. Verify Index

```bash
cg info           # Show machine profile and pipeline sizing
cg search signal  # Search for signal-related symbols
cg routes         # Show detected Express routes
cg context "risk management"  # One-call context bundle
```

### 4. Use the Spec System

```bash
cg spec              # View task board (all phases)
cg spec next         # Get the next eligible task with acceptance criteria
cg spec start 1.1    # Claim task 1.1 (one task at a time)
# ... implement ...
cg commit -m "add riskManager.js"  # Auto-tagged with task
cg spec done 1.1     # Verify against graph + history
cg spec trace 1.1    # Show task → symbols → commits chain
```

### 5. Connect to AI Agents (MCP)

```bash
cg mcp-install       # Auto-connect to Claude Code, Cursor, VS Code, etc.
```

This adds Codify's 15 MCP tools to your agent config:
- `search`, `context`, `symbol`, `impact`, `routes`
- `status`, `changes`, `log`, `commit`
- `spec_status`, `spec_next`, `spec_start`, `spec_done`, `spec_render`, `spec_trace`

### 6. Watch Mode (Auto-Sync)

```bash
cg watch             # Auto-reindex on file changes (inotify/FSEvents)
```

## Files Created for Integration

| File | Purpose |
|---|---|
| `.cgignore` | Exclude node_modules, dist, DB files, APKs, keys from indexing |
| `spec/workflow.kvx` | Master spec: 7 phases, 22 tasks, dependency waves, acceptance criteria |
| `spec/requirements.md` | Feature requirements (R1-R8) |
| `spec/design.md` | Technical architecture and module descriptions |
| `spec/tasks.md` | Human-readable task board (markdown) |
| `AGENTS.md` | Agent guide: directory map, entry points, build commands, routes |

## Spec Workflow

The spec system turns your TODO.md into **verified, tracked work**:

1. **`cg spec next`** — shows the next eligible task with do-bullets and acceptance criteria
2. **`cg spec start <id>`** — claims it (one at a time)
3. **Implement** — use `cg context` for code context, `cg impact` for dependency analysis
4. **`cg commit`** — auto-tags with task ID
5. **`cg spec done <id>`** — runs verify_cmd + graph checks, refuses if incomplete
6. **`cg spec trace <id>`** — shows the full proof chain: task → symbols → files → commits

## Key Commands for TradeFlow Development

```bash
# Understand the codebase
cg context "signal engine"          # Entry points, symbols, callers, routes
cg impact signalEngine -d 3         # Who breaks if signalEngine changes?
cg search trailingStop              # Find trailing stop references
cg routes /api/live-trading         # Show route handlers

# Track work
cg spec                             # Task board overview
cg spec next                        # What to do next
cg changes                          # Blast radius of uncommitted edits
cg changelog                        # Symbol-level release notes

# Version control (built-in, no Git dependency)
cg commit -m "implement feature"    # Snapshot with auto task tag
cg log                              # History
cg diff                             # What changed
```

## Why This Matters for TradeFlow

| Problem | Codify Solution |
|---|---|
| Manual TODO.md tracking | Verified spec system with graph checks |
| "What breaks if I change X?" | `cg impact X -d 3` — instant transitive analysis |
| AI agents wander file-by-file | `cg context` — one call, full picture |
| No release notes | `cg changelog` — symbol-level diffs |
| Changes untracked until commit | `cg changes` — blast radius of uncommitted edits |
