import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initSentry } from './lib/sentry';
import { registerSW } from 'virtual:pwa-register';

initSentry();

// Registra o Service Worker do PWA com atualização automática em segundo plano
if ('serviceWorker' in navigator) {
  registerSW({
    immediate: true,
    onNeedRefresh() {
      console.log('Nova versão do Sistema ERAS disponível.');
    },
    onOfflineReady() {
      console.log('Sistema ERAS pronto para visualizações offline.');
    },
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

