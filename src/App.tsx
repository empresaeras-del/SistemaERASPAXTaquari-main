import { SystemAlertProvider } from './utils/systemAlert';
import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import { ToastProvider } from './context/ToastContext';
import { ConfirmProvider } from './context/ConfirmContext';
import { ErrorBoundary } from "./ErrorBoundary";
import { Layout } from './components/layout/Layout';
import { PrivateRoute } from './components/auth/PrivateRoute';
import { Toaster } from 'react-hot-toast';

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

export default function App() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <AuthProvider>
          <AppProvider>
            <BrowserRouter>
              <ErrorBoundary>
                <SystemAlertProvider />
                <Toaster position="top-right" />
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    {/* Rota pública: Login */}
                    <Route path="/login" element={<LoginPage />} />

                    {/* Rotas protegidas — exigem autenticação */}
                    <Route element={<PrivateRoute />}>
                      <Route path="/" element={<Layout />}>
                        <Route index element={<Dashboard />} />
                        <Route path="associados" element={<AssociadosPage />} />
                        <Route path="requisicoes" element={<RequisicoesPage />} />
                        <Route path="contratos" element={<ContratosPage />} />
                        <Route path="atendimentos" element={<AtendimentosPage />} />
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
                        <Route path="credenciados/faturamentos" element={<FaturamentosPage />} />
                        <Route path="fornecedores" element={<FornecedoresPage />} />
                        <Route path="auditoria" element={<AuditoriaPage />} />
                        <Route path="documentos" element={<DocumentosPadroesPage />} />
                        <Route path="configuracoes" element={<ConfiguracoesPage />} />
                      </Route>
                    </Route>
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
