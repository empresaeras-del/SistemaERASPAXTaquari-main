import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/**
 * PrivateRoute — protege todas as rotas que exigem autenticação.
 * - Se ainda está carregando a sessão: mostra spinner
 * - Se não autenticado: redireciona para /login
 * - Se autenticado: renderiza a rota filha (Outlet)
 */
export const PrivateRoute: React.FC = () => {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="private-route-loading">
        <div className="private-route-spinner" />
        <span>Carregando...</span>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};
