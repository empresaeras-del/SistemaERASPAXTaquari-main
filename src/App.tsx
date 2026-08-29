import { SystemAlertProvider } from './utils/systemAlert';
import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import { ToastProvider } from './context/ToastContext';
import { ConfirmProvider } from './context/ConfirmContext';
import { ErrorBoundary } from "./ErrorBoundary";
import { Layout } from './components/layout/Layout';
import { PrivateRoute } from './components/auth/PrivateRoute';
import { Toaster } from 'react-hot-toast';
import { InactivityManager } from './components/auth/InactivityManager';

// Componente de carregamento suave para lazy loading
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[400px] w-full">
    <div className="flex flex-col items-center gap-3">
      <div className="w-9 h-9 border-3 border-blue-500/20 border-t-blue-600 rounded-full animate-spin" />
      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Carregando módulo...</span>
    </div>
  </div>
);

// Lazy loading de todas as páginas da aplicação
const LoginPage = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const AssociadosPage = lazy(() => import('./pages/Associados').then(m => ({ default: m.AssociadosPage })));
const ContratosPage = lazy(() => import('./pages/ContratosPage').then(m => ({ default: m.ContratosPage })));
const AtendimentosPage = lazy(() => import('./pages/Atendimentos').then(m => ({ default: m.AtendimentosPage })));
const ConfiguracoesPage = lazy(() => import('./pages/Configuracoes').then(m => ({ default: m.ConfiguracoesPage })));
const DocumentosPadroesPage = lazy(() => import('./pages/DocumentosPadroesPage').then(m => ({ default: m.DocumentosPadroesPage })));
const AuditoriaPage = lazy(() => import('./pages/Auditoria').then(m => ({ default: m.AuditoriaPage })));
const PlanosPaxPage = lazy(() => import('./pages/PlanosPaxPage').then(m => ({ default: m.PlanosPaxPage })));
const ItensFunerariosPage = lazy(() => import('./pages/ItensFunerariosPage').then(m => ({ default: m.ItensFunerariosPage })));
const CredenciadosPage = lazy(() => import('./pages/CredenciadosPage').then(m => ({ default: m.CredenciadosPage })));
const ProcedimentosPage = lazy(() => import('./pages/ProcedimentosPage').then(m => ({ default: m.ProcedimentosPage })));
const ContasReceberPage = lazy(() => import('./pages/ContasReceberPage').then(m => ({ default: m.ContasReceberPage })));
const ContasPagarPage = lazy(() => import('./pages/ContasPagarPage').then(m => ({ default: m.ContasPagarPage })));
const ContasReceberFormPage = lazy(() => import('./pages/ContasReceberFormPage').then(m => ({ default: m.ContasReceberFormPage })));
const ContasPagarFormPage = lazy(() => import('./pages/ContasPagarFormPage').then(m => ({ default: m.ContasPagarFormPage })));
const RequisicoesPage = lazy(() => import('./pages/RequisicoesPage').then(m => ({ default: m.RequisicoesPage })));
const FaturamentosPage = lazy(() => import('./pages/FaturamentosPage').then(m => ({ default: m.FaturamentosPage })));
const FornecedoresPage = lazy(() => import('./pages/FornecedoresPage').then(m => ({ default: m.FornecedoresPage })));
const CaixasPage = lazy(() => import('./pages/CaixasPage').then(m => ({ default: m.CaixasPage })));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage').then(m => ({ default: m.ResetPasswordPage })));

export default function App() {
  useEffect(() => {
    const handleInput = (e: Event) => {
      const target = e.target as HTMLInputElement | HTMLTextAreaElement;
      
      if (
        target &&
        ((target.tagName === 'INPUT' && (target.type === 'text' || target.type === 'search')) ||
          target.tagName === 'TEXTAREA')
      ) {
        // Ignora campos de senha, email, url ou marcados explicitamente para não converter
        const inputType = (target.getAttribute('type') || target.type || '').toLowerCase();
        const inputId = (target.id || '').toLowerCase();
        const inputName = (target.name || '').toLowerCase();
        const inputAutocomplete = (target.autocomplete || target.getAttribute('autocomplete') || '').toLowerCase();
        const inputClass = (target.className || '').toLowerCase();

        if (
          target.type === 'email' ||
          target.type === 'password' ||
          target.type === 'url' ||
          inputType === 'password' ||
          inputType === 'email' ||
          inputType === 'url' ||
          target.dataset.noUppercase === 'true' ||
          target.getAttribute('data-no-uppercase') === 'true' ||
          inputId.includes('password') ||
          inputId.includes('senha') ||
          inputId.includes('pass') ||
          inputId.includes('email') ||
          inputName.includes('password') ||
          inputName.includes('senha') ||
          inputName.includes('pass') ||
          inputName.includes('email') ||
          inputAutocomplete.includes('password') ||
          inputAutocomplete.includes('email') ||
          inputClass.includes('no-uppercase')
        ) return;

        const upper = target.value.toUpperCase();
        if (target.value !== upper) {
          const start = target.selectionStart;
          const end = target.selectionEnd;
          
          target.value = upper;
          
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            'value'
          )?.set;
          const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype,
            'value'
          )?.set;
          
          if (target.tagName === 'INPUT' && nativeInputValueSetter) {
            nativeInputValueSetter.call(target, upper);
          } else if (target.tagName === 'TEXTAREA' && nativeTextAreaValueSetter) {
            nativeTextAreaValueSetter.call(target, upper);
          }
          
          target.dispatchEvent(new Event('input', { bubbles: true }));
          
          if (start !== null && end !== null) {
             target.setSelectionRange(start, end);
          }
        }
      }
    };

    document.addEventListener('input', handleInput, true);

    return () => {
      document.removeEventListener('input', handleInput, true);
    };
  }, []);

  return (
    <ToastProvider>
      <ConfirmProvider>
        <AuthProvider>
          <AppProvider>
            <BrowserRouter>
              <ErrorBoundary>
                <SystemAlertProvider />
                <InactivityManager />
                <Toaster position="top-right" />
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    {/* Rota pública: Login */}
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/reset-password" element={<ResetPasswordPage />} />

                    {/* Rotas protegidas — exigem autenticação */}
                    <Route element={<PrivateRoute />}>
                      <Route path="/" element={<Layout />}>
                        <Route index element={<Dashboard />} />
                        <Route path="associados" element={<AssociadosPage />} />
                        <Route path="requisicoes" element={<RequisicoesPage />} />
                        <Route path="contratos" element={<ContratosPage />} />
                        <Route path="atendimentos" element={<AtendimentosPage />} />
                        <Route path="financeiro" element={<Navigate to="/financeiro/contas-a-receber" replace />} />
                        <Route path="financeiro/contas-a-receber" element={<ContasReceberPage />} />
                        <Route path="financeiro/contas-a-pagar" element={<ContasPagarPage />} />
                        <Route path="financeiro/caixas" element={<CaixasPage />} />
                        <Route path="caixas" element={<CaixasPage />} />
                        <Route path="financeiro/contas-a-receber/nova" element={<ContasReceberFormPage />} />
                        <Route path="financeiro/contas-a-receber/:id/editar" element={<ContasReceberFormPage />} />
                        <Route path="financeiro/contas-a-pagar/nova" element={<ContasPagarFormPage />} />
                        <Route path="financeiro/contas-a-pagar/:id/editar" element={<ContasPagarFormPage />} />
                        <Route path="planos" element={<PlanosPaxPage />} />
                        <Route path="itens-funerarios" element={<ItensFunerariosPage />} />
                        <Route path="credenciados" element={<CredenciadosPage />} />
                        <Route path="procedimentos" element={<ProcedimentosPage />} />
                        <Route path="faturamentos" element={<FaturamentosPage />} />
                        <Route path="fornecedores" element={<FornecedoresPage />} />
                        <Route path="auditoria" element={<AuditoriaPage />} />
                        <Route path="documentos" element={<DocumentosPadroesPage />} />
                        <Route path="configuracoes" element={<ConfiguracoesPage />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                      </Route>
                    </Route>
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Suspense>
              </ErrorBoundary>
            </BrowserRouter>
          </AppProvider>
        </AuthProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}
