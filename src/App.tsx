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
import { LoginPage } from './pages/LoginPage';
import { Dashboard } from './pages/Dashboard';
import { AssociadosPage } from './pages/Associados';
import { ContratosPage } from './pages/ContratosPage';
import { AtendimentosPage } from './pages/Atendimentos';
import { ConfiguracoesPage } from './pages/Configuracoes';
import { DocumentosPadroesPage } from './pages/DocumentosPadroesPage';
import { AuditoriaPage } from './pages/Auditoria';
import { PlanosPaxPage } from './pages/PlanosPaxPage';
import { ItensFunerariosPage } from './pages/ItensFunerariosPage';
import { CredenciadosPage } from './pages/CredenciadosPage';
import { ProcedimentosPage } from './pages/ProcedimentosPage';
import { ContasReceberPage } from './pages/ContasReceberPage';
import { ContasPagarPage } from './pages/ContasPagarPage';
import { ContasReceberFormPage } from './pages/ContasReceberFormPage';
import { ContasPagarFormPage } from './pages/ContasPagarFormPage';
import { RequisicoesPage } from './pages/RequisicoesPage';
import { FaturamentosPage } from './pages/FaturamentosPage';
import { FornecedoresPage } from './pages/FornecedoresPage';
import { Toaster } from 'react-hot-toast';

const CaixasPage = lazy(() => import('./pages/CaixasPage').then(module => ({ default: module.CaixasPage })));

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
                      <Route path="financeiro/caixas" element={<Suspense fallback={<div>Carregando...</div>}><CaixasPage /></Suspense>} />
                      <Route path="caixas" element={<Suspense fallback={<div>Carregando...</div>}><CaixasPage /></Suspense>} />
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
              </ErrorBoundary>
            </BrowserRouter>
          </AppProvider>
        </AuthProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}
