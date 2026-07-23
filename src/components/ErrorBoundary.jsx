import { Component } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Sentry } from '../utils/sentry';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('[TradeFlow ErrorBoundary]', error, errorInfo);
    // Report to Sentry with component stack context
    Sentry?.captureException(error, {
      contexts: { react: { componentStack: errorInfo?.componentStack } },
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          minHeight: '100vh', background: 'var(--color-surface-0)',
          padding: '2rem', fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
        }}>
          <div style={{
            maxWidth: 480, width: '100%', textAlign: 'center',
            background: 'var(--color-surface-1)', border: '1px solid var(--color-border-default)',
            borderRadius: 20, padding: '3rem 2rem',
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16, margin: '0 auto 1.5rem',
              background: 'var(--color-loss-18)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <AlertTriangle size={28} color="var(--color-loss)" />
            </div>
            <h1 style={{
              fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text-primary)',
              marginBottom: '0.5rem', letterSpacing: '-0.02em',
            }}>
              Something went wrong
            </h1>
            <p style={{
              fontSize: '0.875rem', color: 'var(--color-text-secondary)',
              marginBottom: '2rem', lineHeight: 1.6,
            }}>
              A component crashed unexpectedly. You can try reloading the page or going back to the home screen.
            </p>
            {this.state.error && (
              <details style={{
                marginBottom: '2rem', textAlign: 'left',
                background: 'var(--color-surface-2)', borderRadius: 12,
                padding: '1rem', fontSize: '0.75rem',
              }}>
                <summary style={{
                  color: 'var(--color-text-muted)', cursor: 'pointer',
                  fontFamily: 'monospace', marginBottom: '0.5rem',
                }}>
                  Error details
                </summary>
                <pre style={{
                  color: 'var(--color-danger-light)', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  fontFamily: 'monospace', fontSize: '0.7rem', lineHeight: 1.5,
                }}>
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                onClick={this.handleReset}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '10px 20px', borderRadius: 12,
                  background: 'linear-gradient(135deg, var(--color-accent), var(--color-accent-secondary))',
                  color: 'var(--color-text-white)', fontWeight: 700, fontSize: '0.875rem',
                  border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                }}
              >
                <RefreshCw size={16} /> Try Again
              </button>
              <button
                onClick={this.handleGoHome}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '10px 20px', borderRadius: 12,
                  background: 'var(--color-surface-2)',
                  color: 'var(--color-text-primary)', fontWeight: 600, fontSize: '0.875rem',
                  border: '1px solid var(--color-border-strong)', cursor: 'pointer', transition: 'all 0.2s',
                }}
              >
                <Home size={16} /> Go Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
