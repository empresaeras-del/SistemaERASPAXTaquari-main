import React, { useState, useEffect } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getEmpresas, Empresa } from '../services/empresasService';
import { Clock } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { signIn, signUp, resetPassword, session, user, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const [isInactivity, setIsInactivity] = useState(() => {
    return searchParams.get('reason') === 'inactivity' || sessionStorage.getItem('eras_logout_reason') === 'inactivity';
  });

  useEffect(() => {
    if (sessionStorage.getItem('eras_logout_reason') === 'inactivity') {
      setIsInactivity(true);
      sessionStorage.removeItem('eras_logout_reason');
    }
  }, []);

  // Login states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Register states
  const [regNome, setRegNome] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regTenantId, setRegTenantId] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState(false);

  // Common states
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [forgotSent, setForgotSent] = useState(false);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);

  useEffect(() => {
    // Carrega empresas para seleção no cadastro
    getEmpresas(true).then((data) => {
      if (data && data.length > 0) {
        setEmpresas(data);
        setRegTenantId(data[0].id);
      }
    }).catch(() => { });
  }, []);

  // Se já logado, redireciona para o sistema
  if (!loading && session) {
    return <Navigate to="/" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Preencha email e senha.');
      return;
    }
    setError(null);
    setIsLoading(true);
    const { error: loginError } = await signIn(email, password);
    setIsLoading(false);
    if (loginError) setError(loginError);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regNome.trim() || !regEmail.trim() || !regPassword) {
      setError('Preencha todos os campos obrigatórios.');
      return;
    }
    if (regPassword.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setError(null);
    setIsLoading(true);

    const { error: regError } = await signUp(regEmail.trim(), regPassword, {
      nome: regNome.trim(),
      tenant_id: regTenantId || 'default'
    });

    setIsLoading(false);

    if (regError) {
      setError(regError);
    } else {
      setRegisterSuccess(true);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Digite seu email para recuperar a senha.');
      return;
    }
    setError(null);
    setIsLoading(true);
    const { error: resetError } = await resetPassword(email);
    setIsLoading(false);
    if (resetError) {
      setError(resetError);
    } else {
      setForgotSent(true);
    }
  };

  return (
    <div className="login-page">
      {/* Background decorativo */}
      <div className="login-bg">
        <div className="login-bg-grid" />
        <div className="login-bg-orb login-bg-orb-1" />
        <div className="login-bg-orb login-bg-orb-2" />
        <div className="login-bg-orb login-bg-orb-3" />
      </div>

      <div className="login-container">
        {/* Lado esquerdo — Branding com Emblema Animado ERAS */}
        <div className="login-brand">
          <div className="login-brand-content">
            <div className="eras-emblem-showcase">
              <div className="eras-emblem-halo" />
              <div className="eras-emblem-cyber-ring" />
              <div className="eras-emblem-card">
                <img
                  src="/eras-cyber-emblem.jpg"
                  alt="ERAS Emblema Cyber"
                  className="eras-emblem-img"
                />
                <div className="eras-emblem-scanline" />
                <div className="eras-emblem-sheen" />
              </div>
            </div>

            <div className="login-brand-tag">
              <span className="login-brand-tag-dot" />
              <span>Tecnologia & Gestão PAX</span>
            </div>

            <h1 className="login-brand-title">Sistema ERAS v 1.0</h1>
            <p className="login-brand-subtitle">Sistema de Gestão Funerária & Planos</p>

            <div className="login-brand-features">
              <div className="login-feature-item">
                <span className="login-feature-dot" />
                <span>Gestão completa de associados e planos</span>
              </div>
              <div className="login-feature-item">
                <span className="login-feature-dot" />
                <span>Controle financeiro integrado</span>
              </div>
              <div className="login-feature-item">
                <span className="login-feature-dot" />
                <span>Emissão de requisições e faturamentos</span>
              </div>
              <div className="login-feature-item">
                <span className="login-feature-dot" />
                <span>Relatórios e auditoria em tempo real</span>
              </div>
            </div>
          </div>
          <p className="login-brand-footer">
            Coxim, Mato Grosso do Sul &nbsp;•&nbsp; {new Date().getFullYear()}
          </p>
        </div>

        {/* Lado direito — Formulário */}
        <div className="login-form-side">
          <div className="login-card">
            {/* Emblema mobile (visível em telas menores) */}
            <div className="login-mobile-emblem">
              <div className="login-mobile-emblem-card">
                <img src="/eras-cyber-emblem.jpg" alt="ERAS" />
              </div>
              <div>
                <div className="text-white font-bold text-lg leading-tight">ERAS PAX</div>
                <div className="text-xs text-rose-400 font-medium">Gestão Funerária</div>
              </div>
            </div>

            {/* === MODO LOGIN === */}
            {mode === 'login' && (
              <>
                <div className="login-card-header">
                  <h2 className="login-card-title">Bem-vindo de volta</h2>
                  <p className="login-card-desc">Entre com suas credenciais para acessar o sistema</p>
                </div>

                <form onSubmit={handleLogin} className="login-form" noValidate>
                  {isInactivity && !error && (
                    <div className="mb-4 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-3 shadow-sm animate-in fade-in">
                      <Clock className="w-5 h-5 text-amber-400 shrink-0" />
                      <span>Sua sessão foi encerrada automaticamente por inatividade. Faça login para continuar.</span>
                    </div>
                  )}

                  {error && (
                    <div className="login-error" role="alert">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="login-error-icon">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="login-field">
                    <label htmlFor="login-email" className="login-label">Email</label>
                    <div className="login-input-wrap">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="login-input-icon">
                        <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                        <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                      </svg>
                      <input
                        id="login-email"
                        type="email"
                        autoComplete="email"
                        placeholder="seu@email.com"
                        value={email}
                        onChange={e => { setEmail(e.target.value); setError(null); }}
                        className="login-input"
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  <div className="login-field">
                    <label htmlFor="login-password" className="login-label">Senha</label>
                    <div className="login-input-wrap">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="login-input-icon">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
                      <input
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        placeholder="••••••••"
                        value={password}
                        onChange={e => { setPassword(e.target.value); setError(null); }}
                        className="login-input login-input-password"
                        disabled={isLoading}
                      />
                      <button
                        type="button"
                        className="login-toggle-password"
                        onClick={() => setShowPassword(v => !v)}
                        tabIndex={-1}
                        aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      >
                        {showPassword ? (
                          <svg viewBox="0 0 20 20" fill="currentColor">
                            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                            <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                            <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="login-forgot-row">
                    <button
                      type="button"
                      className="login-forgot-link"
                      onClick={() => { setMode('forgot'); setError(null); }}
                    >
                      Esqueci minha senha
                    </button>
                  </div>

                  <button
                    type="submit"
                    className="login-btn-primary"
                    disabled={isLoading}
                    id="login-submit-btn"
                  >
                    {isLoading ? (
                      <>
                        <span className="login-btn-spinner" />
                        <span>Entrando...</span>
                      </>
                    ) : (
                      <>
                        <span>Entrar no Sistema</span>
                        <svg viewBox="0 0 20 20" fill="currentColor" className="login-btn-arrow">
                          <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </>
                    )}
                  </button>


                </form>
              </>
            )}

            {/* === MODO CADASTRO (REGISTER) === */}
            {mode === 'register' && (
              <>
                <div className="login-card-header">
                  <button
                    className="login-back-btn"
                    onClick={() => { setMode('login'); setError(null); setRegisterSuccess(false); }}
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                    </svg>
                    Voltar ao login
                  </button>
                  <h2 className="login-card-title" style={{ marginTop: '0.75rem' }}>Criar nova conta</h2>
                  <p className="login-card-desc">Preencha seus dados para solicitar acesso ao sistema</p>
                </div>

                {registerSuccess ? (
                  <div className="login-success">
                    <div className="login-success-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <h3>Conta cadastrada com sucesso!</h3>
                    <p>Sua conta foi criada no Supabase. Você já pode fazer login com seu e-mail e senha.</p>
                    <button
                      className="login-btn-secondary"
                      onClick={() => {
                        setMode('login');
                        setEmail(regEmail);
                        setRegisterSuccess(false);
                      }}
                    >
                      Ir para o Login
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleRegister} className="login-form" noValidate>
                    {error && (
                      <div className="login-error" role="alert">
                        <svg viewBox="0 0 20 20" fill="currentColor" className="login-error-icon">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <span>{error}</span>
                      </div>
                    )}

                    <div className="login-field">
                      <label htmlFor="reg-nome" className="login-label">Nome Completo *</label>
                      <div className="login-input-wrap">
                        <input
                          id="reg-nome"
                          type="text"
                          required
                          placeholder="Seu Nome Completo"
                          value={regNome}
                          onChange={e => { setRegNome(e.target.value); setError(null); }}
                          className="login-input"
                          style={{ paddingLeft: '0.875rem' }}
                          disabled={isLoading}
                        />
                      </div>
                    </div>

                    <div className="login-field">
                      <label htmlFor="reg-email" className="login-label">Email *</label>
                      <div className="login-input-wrap">
                        <input
                          id="reg-email"
                          type="email"
                          required
                          autoComplete="email"
                          placeholder="seu@email.com"
                          value={regEmail}
                          onChange={e => { setRegEmail(e.target.value); setError(null); }}
                          className="login-input"
                          style={{ paddingLeft: '0.875rem' }}
                          disabled={isLoading}
                        />
                      </div>
                    </div>

                    {empresas.length > 0 && (
                      <div className="login-field">
                        <label htmlFor="reg-empresa" className="login-label">Empresa / Unidade</label>
                        <div className="login-input-wrap">
                          <select
                            id="reg-empresa"
                            value={regTenantId}
                            onChange={e => setRegTenantId(e.target.value)}
                            className="login-input"
                            style={{ paddingLeft: '0.875rem' }}
                            disabled={isLoading}
                          >
                            {empresas.map(emp => (
                              <option key={emp.id} value={emp.id} className="bg-slate-900">
                                {emp.nome_fantasia || emp.razao_social}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    <div className="login-field">
                      <label htmlFor="reg-password" className="login-label">Senha * (mínimo 6 dígitos)</label>
                      <div className="login-input-wrap">
                        <input
                          id="reg-password"
                          type={showRegPassword ? 'text' : 'password'}
                          required
                          autoComplete="new-password"
                          placeholder="••••••••"
                          value={regPassword}
                          onChange={e => { setRegPassword(e.target.value); setError(null); }}
                          className="login-input login-input-password"
                          style={{ paddingLeft: '0.875rem' }}
                          disabled={isLoading}
                        />
                        <button
                          type="button"
                          className="login-toggle-password"
                          onClick={() => setShowRegPassword(v => !v)}
                          tabIndex={-1}
                        >
                          {showRegPassword ? (
                            <svg viewBox="0 0 20 20" fill="currentColor">
                              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                              <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                              <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="login-field">
                      <label htmlFor="reg-confirm" className="login-label">Confirmar Senha *</label>
                      <div className="login-input-wrap">
                        <input
                          id="reg-confirm"
                          type={showRegPassword ? 'text' : 'password'}
                          required
                          autoComplete="new-password"
                          placeholder="••••••••"
                          value={regConfirmPassword}
                          onChange={e => { setRegConfirmPassword(e.target.value); setError(null); }}
                          className="login-input"
                          style={{ paddingLeft: '0.875rem' }}
                          disabled={isLoading}
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="login-btn-primary"
                      disabled={isLoading}
                      id="register-submit-btn"
                    >
                      {isLoading ? (
                        <>
                          <span className="login-btn-spinner" />
                          <span>Cadastrando...</span>
                        </>
                      ) : (
                        <span>Concluir Cadastro</span>
                      )}
                    </button>

                    <div className="pt-2 text-center">
                      <span className="text-xs text-slate-400">Já possui uma conta? </span>
                      <button
                        type="button"
                        className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
                        onClick={() => { setMode('login'); setError(null); }}
                      >
                        Fazer Login
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}

            {/* === MODO ESQUECI MINHA SENHA === */}
            {mode === 'forgot' && (
              <>
                <div className="login-card-header">
                  <button
                    className="login-back-btn"
                    onClick={() => { setMode('login'); setError(null); setForgotSent(false); }}
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                    </svg>
                    Voltar ao login
                  </button>
                  <h2 className="login-card-title" style={{ marginTop: '0.75rem' }}>Recuperar senha</h2>
                  <p className="login-card-desc">Informe seu email e enviaremos um link de recuperação</p>
                </div>

                {forgotSent ? (
                  <div className="login-success">
                    <div className="login-success-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <h3>Email enviado!</h3>
                    <p>Verifique sua caixa de entrada em <strong>{email}</strong> e clique no link para redefinir sua senha.</p>
                    <button
                      className="login-btn-secondary"
                      onClick={() => { setMode('login'); setForgotSent(false); }}
                    >
                      Voltar ao login
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleForgotPassword} className="login-form" noValidate>
                    {error && (
                      <div className="login-error" role="alert">
                        <svg viewBox="0 0 20 20" fill="currentColor" className="login-error-icon">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <span>{error}</span>
                      </div>
                    )}

                    <div className="login-field">
                      <label htmlFor="forgot-email" className="login-label">Email cadastrado</label>
                      <div className="login-input-wrap">
                        <svg viewBox="0 0 20 20" fill="currentColor" className="login-input-icon">
                          <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                          <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                        </svg>
                        <input
                          id="forgot-email"
                          type="email"
                          autoComplete="email"
                          placeholder="seu@email.com"
                          value={email}
                          onChange={e => { setEmail(e.target.value); setError(null); }}
                          className="login-input"
                          disabled={isLoading}
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="login-btn-primary"
                      disabled={isLoading}
                      id="forgot-submit-btn"
                    >
                      {isLoading ? (
                        <>
                          <span className="login-btn-spinner" />
                          <span>Enviando...</span>
                        </>
                      ) : (
                        <span>Enviar link de recuperação</span>
                      )}
                    </button>
                  </form>
                )}
              </>
            )}

            <p className="login-card-footer-text">
              ERAS PAX &copy; {new Date().getFullYear()} — Todos os direitos reservados
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
