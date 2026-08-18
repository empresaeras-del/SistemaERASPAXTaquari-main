import React, { Component, ErrorInfo, ReactNode } from "react";

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

const isDev = import.meta.env.DEV;

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    // Report to Sentry in production if available
    try {
      const Sentry = require('@sentry/react');
      if (Sentry?.captureException) {
        Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } });
      }
    } catch (_) {
      // Sentry not available, ignore
    }
  }

  public render() {
    if (this.state.hasError) {
      if (isDev) {
        // Development: show full error details for debugging
        return (
          <div style={{padding: 20, background: '#1a1a2e', color: '#e94560', fontFamily: 'monospace'}}>
            <h1 style={{color: '#e94560'}}>⚠️ Erro de Desenvolvimento</h1>
            <pre style={{whiteSpace: 'pre-wrap', wordBreak: 'break-all'}}>{this.state.error && this.state.error.toString()}</pre>
            <pre style={{whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: '#aaa', fontSize: 12}}>{this.state.error && this.state.error.stack}</pre>
          </div>
        );
      }

      // Production: show user-friendly message
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: '#f8f9fa',
          fontFamily: 'Inter, system-ui, sans-serif',
          padding: 40,
          textAlign: 'center'
        }}>
          <div style={{fontSize: 48, marginBottom: 16}}>😔</div>
          <h1 style={{color: '#1a1a2e', fontSize: 24, marginBottom: 8}}>Algo deu errado</h1>
          <p style={{color: '#666', fontSize: 16, marginBottom: 24, maxWidth: 400}}>
            Ocorreu um erro inesperado. Por favor, tente recarregar a página.
            Se o problema persistir, entre em contato com o suporte.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '12px 24px',
              fontSize: 16,
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            Recarregar Página
          </button>
        </div>
      );
    }

    return (this.props as any).children;
  }
}
