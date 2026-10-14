import { Component, type ErrorInfo, type ReactNode } from 'react';
import { RotateCcw, AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          textAlign: 'center',
          background: '#fdfcf9',
          color: '#1a1a1a',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.9)',
            border: '1px solid rgba(0, 0, 0, 0.08)',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.08)',
            borderRadius: '24px',
            padding: '40px 32px',
            maxWidth: '480px',
            width: '100%'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: '#fee2e2',
              color: '#dc2626',
              display: 'grid',
              placeItems: 'center',
              margin: '0 auto 20px'
            }}>
              <AlertTriangle size={28} />
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '8px' }}>Something went wrong</h2>
            <p style={{ color: '#666', fontSize: '15px', lineHeight: '1.5', marginBottom: '24px' }}>
              StudyNest ran into an issue switching views.
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.href = '/';
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 24px',
                borderRadius: '12px',
                background: '#1a1a1a',
                color: '#fff',
                fontSize: '15px',
                fontWeight: '600',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              <RotateCcw size={16} /> Return to Home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
