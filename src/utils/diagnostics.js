/**
 * Diagnostics Collector
 * 
 * Captures console logs, network errors, and page screenshots
 * so bug reports can be submitted with rich context automatically.
 */

const MAX_LOGS = 200;
const MAX_NETWORK_ERRORS = 50;

// ── Ring buffers ──────────────────────────────────────────────
const consoleLogs = [];
const networkErrors = [];

let _intercepted = false;

// ── Console interceptor ───────────────────────────────────────

function severity(level) {
  if (level === 'error') return 'error';
  if (level === 'warn') return 'warn';
  if (level === 'info') return 'info';
  return 'debug';
}

export function interceptConsole() {
  if (_intercepted) return;
  _intercepted = true;

  const levels = ['log', 'info', 'warn', 'error', 'debug'];
  const originals = {};

  levels.forEach(level => {
    originals[level] = console[level];
    console[level] = (...args) => {
      originals[level].apply(console, args);

      // Skip our own internal noise
      const first = typeof args[0] === 'string' ? args[0] : '';
      if (first.startsWith('[Sentry]') || first.startsWith('[Diagnostics]')) return;

      consoleLogs.push({
        level: severity(level),
        time: new Date().toISOString(),
        message: args.map(a => {
          if (a instanceof Error) return `${a.name}: ${a.message}`;
          if (typeof a === 'object') {
            try { return JSON.stringify(a, null, 0); } catch { return String(a); }
          }
          return String(a);
        }).join(' '),
      });

      // Trim ring buffer
      if (consoleLogs.length > MAX_LOGS) consoleLogs.splice(0, consoleLogs.length - MAX_LOGS);
    };
  });
}

// ── Network error interceptor ─────────────────────────────────

export function interceptNetworkErrors() {
  // Intercept fetch failures
  const origFetch = window.fetch;
  window.fetch = async (...args) => {
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || String(args[0]);
    const method = args[1]?.method || 'GET';
    const start = performance.now();

    try {
      const res = await origFetch.apply(window, args);
      if (!res.ok) {
        recordNetworkError({
          type: 'fetch',
          url,
          method,
          status: res.status,
          statusText: res.statusText,
          duration: Math.round(performance.now() - start),
        });
      }
      return res;
    } catch (err) {
      recordNetworkError({
        type: 'fetch',
        url,
        method,
        error: err.message,
        duration: Math.round(performance.now() - start),
      });
      throw err;
    }
  };

  // Intercept XHR failures
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this._diag = { method, url };
    return origOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function (...args) {
    const start = performance.now();
    this.addEventListener('error', () => {
      recordNetworkError({
        type: 'xhr',
        ...this._diag,
        error: 'Network error',
        duration: Math.round(performance.now() - start),
      });
    });
    this.addEventListener('load', () => {
      if (this.status >= 400) {
        recordNetworkError({
          type: 'xhr',
          ...this._diag,
          status: this.status,
          statusText: this.statusText,
          duration: Math.round(performance.now() - start),
        });
      }
    });
    return origSend.apply(this, args);
  };
}

function recordNetworkError(entry) {
  entry.time = new Date().toISOString();
  networkErrors.push(entry);
  if (networkErrors.length > MAX_NETWORK_ERRORS) networkErrors.splice(0, networkErrors.length - MAX_NETWORK_ERRORS);
}

// ── Screenshot capture ────────────────────────────────────────

let _html2canvas = null;

async function getHtml2Canvas() {
  if (!_html2canvas) {
    try {
      const mod = await import('html2canvas');
      _html2canvas = mod.default || mod;
    } catch (e) {
      console.warn('[Diagnostics] html2canvas not available:', e.message);
      return null;
    }
  }
  return _html2canvas;
}

export async function captureScreenshot() {
  const h2c = await getHtml2Canvas();
  if (!h2c) return null;

  try {
    // Hide the bug report modal itself so it doesn't appear in the screenshot
    const bugBtn = document.querySelector('[data-bugreport]');
    if (bugBtn) bugBtn.style.display = 'none';

    const canvas = await h2c(document.body, {
      backgroundColor: '#0b0f1a',
      scale: 0.5,         // half res for smaller payload
      useCORS: true,
      logging: false,
      width: window.innerWidth,
      height: window.innerHeight,
    });

    if (bugBtn) bugBtn.style.display = '';

    // Return as low-quality JPEG data URL (keeps it under ~200KB)
    return canvas.toDataURL('image/jpeg', 0.5);
  } catch (err) {
    console.warn('[Diagnostics] Screenshot failed:', err.message);
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────

export function getConsoleLogs(level) {
  if (!level) return [...consoleLogs];
  return consoleLogs.filter(l => l.level === level);
}

export function getNetworkErrors() {
  return [...networkErrors];
}

export function getErrorSummary() {
  const errors = consoleLogs.filter(l => l.level === 'error');
  const warns = consoleLogs.filter(l => l.level === 'warn');
  const failed = networkErrors.filter(e => !e.status || e.status >= 500);
  const clientErrors = networkErrors.filter(e => e.status >= 400 && e.status < 500);

  return {
    consoleErrors: errors.length,
    consoleWarnings: warns.length,
    networkFailures: failed.length,
    networkClientErrors: clientErrors.length,
    totalLogs: consoleLogs.length,
    totalNetworkEvents: networkErrors.length,
    recentErrors: errors.slice(-5).map(e => e.message),
    recentNetworkErrors: [...failed, ...clientErrors].slice(-5),
  };
}

export async function collectDiagnostics(userDescription) {
  const summary = getErrorSummary();
  const screenshot = await captureScreenshot();

  return {
    timestamp: new Date().toISOString(),
    url: window.location.href,
    userAgent: navigator.userAgent,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    description: userDescription || '',
    summary,
    consoleLogs: consoleLogs.slice(-50),        // last 50 entries
    networkErrors: networkErrors.slice(-20),    // last 20 entries
    screenshot: screenshot ? '(screenshot attached)' : '(screenshot unavailable)',
    screenshotDataUrl: screenshot,
  };
}

export function clearDiagnostics() {
  consoleLogs.length = 0;
  networkErrors.length = 0;
}
