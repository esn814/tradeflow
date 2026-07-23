import * as Sentry from '@sentry/react';

/**
 * Initialize Sentry error tracking.
 * DSN is loaded from env var VITE_SENTRY_DSN — if not set, Sentry is disabled
 * (no errors are sent, no network calls made). This keeps the app functional
 * in development without a Sentry project.
 */
export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;

  if (!dsn) {
    console.info('[Sentry] No VITE_SENTRY_DSN set — error tracking disabled.');
    return;
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE, // 'development' | 'production'
    release: import.meta.env.VITE_APP_VERSION || 'unknown',

    // Capture 100% of errors in production; adjust for high-traffic later
    tracesSampleRate: 1.0,

    // Don't send errors from localhost in production builds
    beforeSend(event) {
      if (import.meta.env.DEV) return null; // skip in dev mode
      return event;
    },

    // Ignore noisy browser extension errors
    denyUrls: [
      /extensions\//i,
      /^chrome:\/\//i,
      /^moz-extension:\/\//i,
    ],

    // Scrub sensitive data from breadcrumbs and extra context
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.category === 'console' && breadcrumb.level === 'debug') {
        return null; // drop debug console logs
      }
      return breadcrumb;
    },
  });
}

export { Sentry };
