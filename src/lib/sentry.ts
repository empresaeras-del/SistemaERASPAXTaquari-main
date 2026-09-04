import * as Sentry from '@sentry/react';

export const initSentry = () => {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  
  if (dsn && dsn !== 'YOUR_SENTRY_DSN') {
    Sentry.init({
      dsn,
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration(),
      ],
      // Performance Monitoring — 100% em dev (depuração local), amostrado em produção para não
      // crescer linearmente com o tráfego real. Ajuste conforme o volume/cota do projeto no Sentry.
      tracesSampleRate: import.meta.env.DEV ? 1.0 : 0.2,
      // Session Replay
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
    });
  } else {
    console.warn('Sentry DSN not configured, skipping initialization.');
  }
};
