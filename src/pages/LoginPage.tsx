import React, { useState, useEffect, useRef } from 'react';
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

  // Common states
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [forgotSent, setForgotSent] = useState(false);

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

  const cursorRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const trailCanvasRef = useRef<HTMLCanvasElement>(null);
  const spotlightRef = useRef<HTMLDivElement>(null);
  const coordsRef = useRef<HTMLDivElement>(null);
  const cardGlowRef = useRef<HTMLDivElement>(null);
  const layer0Ref = useRef<HTMLDivElement>(null);
  const layer1Ref = useRef<HTMLDivElement>(null);
  const logoCenterRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const logoImgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    let mx = window.innerWidth / 2;
    let my = window.innerHeight / 2;
    let cx = mx;
    let cy = my;

    const trailCanvas = trailCanvasRef.current;
    if (!trailCanvas) return;
    const tctx = trailCanvas.getContext('2d');
    if (!tctx) return;
    trailCanvas.width = window.innerWidth;
    trailCanvas.height = window.innerHeight;
    const trails: Array<{ x: number; y: number; life: number; r: number }> = [];
    const MAX_TRAIL = 22;

    const handleResize = () => {
      if (trailCanvas) {
        trailCanvas.width = window.innerWidth;
        trailCanvas.height = window.innerHeight;
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      mx = e.clientX;
      my = e.clientY;

      const px = (mx / window.innerWidth) * 100;
      const py = (my / window.innerHeight) * 100;
      if (spotlightRef.current) {
        spotlightRef.current.style.background = `radial-gradient(circle 550px at ${px}% ${py}%, rgba(140,15,30,0.2) 0%, transparent 70%)`;
      }

      if (coordsRef.current) {
        coordsRef.current.textContent = `X:${String(mx).padStart(4, '0')} Y:${String(my).padStart(4, '0')}`;
      }

      const card = cardRef.current;
      const cardGlow = cardGlowRef.current;
      if (card && cardGlow) {
        const r = card.getBoundingClientRect();
        const gx = mx - r.left;
        const gy = my - r.top;
        if (gx >= 0 && gy >= 0 && gx <= r.width && gy <= r.height) {
          cardGlow.style.left = gx + 'px';
          cardGlow.style.top = gy + 'px';
          cardGlow.style.opacity = '1';
        } else {
          cardGlow.style.opacity = '0';
        }
      }

      trails.push({ x: mx, y: my, life: 1, r: 4 + Math.random() * 3 });
      if (trails.length > MAX_TRAIL) trails.shift();
    };

    window.addEventListener('resize', handleResize);
    document.addEventListener('mousemove', handleMouseMove);

    let animFrame: number;
    const animCursor = () => {
      cx += (mx - cx) * 0.15;
      cy += (my - cy) * 0.15;

      if (cursorRef.current) {
        cursorRef.current.style.left = mx + 'px';
        cursorRef.current.style.top = my + 'px';
      }
      if (ringRef.current) {
        ringRef.current.style.left = cx + 'px';
        ringRef.current.style.top = cy + 'px';
      }

      tctx.clearRect(0, 0, trailCanvas.width, trailCanvas.height);
      for (let i = 0; i < trails.length; i++) {
        trails[i].life -= 0.06;
        if (trails[i].life <= 0) {
          trails.splice(i, 1);
          i--;
          continue;
        }
        const a = trails[i].life * 0.4;
        const r = trails[i].r * trails[i].life;
        tctx.beginPath();
        tctx.arc(trails[i].x, trails[i].y, r, 0, Math.PI * 2);
        tctx.fillStyle = `rgba(200,168,75,${a})`;
        tctx.fill();
      }

      animFrame = requestAnimationFrame(animCursor);
    };
    animCursor();

    const W = window.innerWidth;
    const H = window.innerHeight;
    let smoothX = 0, smoothY = 0;
    const SMOOTH = 0.06;

    let parallaxFrame: number;
    const animParallax = () => {
      const rx = (mx - W / 2) / W;
      const ry = (my - H / 2) / H;

      smoothX += (rx - smoothX) * SMOOTH;
      smoothY += (ry - smoothY) * SMOOTH;

      if (layer0Ref.current) {
        layer0Ref.current.style.transform = `translate3d(${smoothX * -18}px,${smoothY * -12}px,0)`;
      }
      if (layer1Ref.current) {
        layer1Ref.current.style.transform = `translate3d(${smoothX * -32}px,${smoothY * -22}px,0)`;
      }
      if (logoCenterRef.current) {
        logoCenterRef.current.style.transform = `translate(-50%,-50%) translate3d(${smoothX * -48}px,${smoothY * -34}px,0) rotateY(${smoothX * 6}deg) rotateX(${-smoothY * 4}deg)`;
      }
      const card = cardRef.current;
      if (card) {
        const cardRx = smoothX * 7;
        const cardRy = smoothY * 5;
        card.style.transform = `perspective(900px) rotateY(${cardRx}deg) rotateX(${-cardRy}deg) translate3d(${smoothX * -12}px,${smoothY * -8}px,0)`;
      }
      parallaxFrame = requestAnimationFrame(animParallax);
    };
    animParallax();

    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animFrame);
      cancelAnimationFrame(parallaxFrame);
    };
  }, []);

  useEffect(() => {
    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'BUTTON' || target.tagName === 'A' || target.tagName === 'SELECT')) {
        if (cursorRef.current && ringRef.current) {
          cursorRef.current.style.width = '6px';
          cursorRef.current.style.height = '6px';
          ringRef.current.style.width = '52px';
          ringRef.current.style.height = '52px';
          ringRef.current.style.borderColor = 'rgba(200,168,75,0.8)';
        }
      }
    };
    const handleMouseOut = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'BUTTON' || target.tagName === 'A' || target.tagName === 'SELECT')) {
        if (cursorRef.current && ringRef.current) {
          cursorRef.current.style.width = '12px';
          cursorRef.current.style.height = '12px';
          ringRef.current.style.width = '36px';
          ringRef.current.style.height = '36px';
          ringRef.current.style.borderColor = 'rgba(200,168,75,0.5)';
        }
      }
    };

    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('mouseout', handleMouseOut);
    return () => {
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('mouseout', handleMouseOut);
    };
  }, []);

  const handleLogoMouseMove = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!logoImgRef.current) return;
    const r = logoImgRef.current.getBoundingClientRect();
    const lx = (e.clientX - r.left - r.width / 2) / r.width;
    const ly = (e.clientY - r.top - r.height / 2) / r.height;
    logoImgRef.current.style.filter = `
      drop-shadow(0 0 ${24 + Math.abs(lx) * 30}px rgba(155,27,48,${0.8 + Math.abs(lx) * 0.2}))
      drop-shadow(0 0 60px rgba(155,27,48,0.5))
      drop-shadow(${lx * 10}px ${ly * 10}px 40px rgba(200,168,75,0.2))
    `;
  };

  const handleLogoMouseLeave = () => {
    if (!logoImgRef.current) return;
    logoImgRef.current.style.filter = `
      drop-shadow(0 0 20px rgba(155,27,48,0.9))
      drop-shadow(0 0 60px rgba(155,27,48,0.4))
      drop-shadow(0 0 100px rgba(155,27,48,0.2))
    `;
  };

  const particles = Array.from({ length: 28 }).map((_, i) => {
    const s = Math.random() * 2.5 + 0.8;
    const isGold = Math.random() > 0.55;
    return (
      <div
        key={i}
        className="p"
        style={{
          width: `${s}px`,
          height: `${s}px`,
          left: `${Math.random() * 100}%`,
          background: isGold ? 'rgba(200,168,75,0.75)' : 'rgba(155,27,48,0.65)',
          animationDuration: `${13 + Math.random() * 15}s`,
          animationDelay: `${-Math.random() * 28}s`
        }}
      />
    );
  });

  return (
    <div className="eras-v1-login-page">
      {/* Custom cursor */}
      <div id="cursor" ref={cursorRef}></div>
      <div id="cursor-ring" ref={ringRef}></div>
      <canvas id="cursor-trail" ref={trailCanvasRef} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9996 }}></canvas>

      {/* HUD frame */}
      <div className="hud hud-tl"></div>
      <div className="hud hud-tr"></div>
      <div className="hud hud-bl"></div>
      <div className="hud hud-br"></div>
      <div id="coords" ref={coordsRef}>X:000 Y:000</div>

      <div className="hud-data">
        <span>Coxim · MS</span>
        <span className="hud-sep"></span>
        <span>ERAS Tech</span>
        <span className="hud-sep"></span>
        <span className="hud-live">Online</span>
        <span className="hud-sep"></span>
        <span>v 1.0 · {new Date().getFullYear()}</span>
      </div>

      {/* Scene */}
      <div className="scene" id="scene">
        {/* Parallax layer 0 — deepest background */}
        <div className="layer" id="layer0" ref={layer0Ref} style={{ zIndex: 0 }}>
          <div className="bg-deepest"></div>
          <div id="spotlight" ref={spotlightRef}></div>
          <div className="bg-grid"></div>
          <div className="orb o1"></div>
          <div className="orb o2"></div>
          <div className="orb o3"></div>
        </div>

        {/* Parallax layer 1 — debris */}
        <div className="layer" id="layer1" ref={layer1Ref} style={{ zIndex: 1 }}>
          <div className="particles" id="particles">
            {particles}
          </div>
        </div>

        {/* Parallax layer 2 — content */}
        <div className="layer" id="layer2" style={{ zIndex: 10 }}>
          {/* Left panel */}
          <div className="left">
            <div className="brand-group">
              <div className="brand-tag">Tecnologia & Gestão PAX</div>
              <div className="brand-name">Sistema <span className="em">ERAS</span></div>
              <div className="brand-ver">GESTÃO FUNERÁRIA & PLANOS</div>
            </div>
            <div className="hero-line"></div>
            <p className="tagline">
              <strong>Plataforma completa</strong> para gestão de<br />
              associados, planos funerários e<br />
              controle financeiro integrado.
            </p>
            <div className="features">
              <div className="feat"><div className="feat-dot"></div><span className="feat-text">Gestão completa de associados e planos</span></div>
              <div className="feat"><div className="feat-dot"></div><span className="feat-text">Controle financeiro integrado em tempo real</span></div>
              <div className="feat"><div className="feat-dot"></div><span className="feat-text">Emissão de requisições e faturamentos</span></div>
              <div className="feat"><div className="feat-dot"></div><span className="feat-text">Relatórios e auditoria com dashboards avançados</span></div>
            </div>
          </div>

          {/* Vertical divider */}
          <div className="divider"></div>

          {/* Center logo */}
          <div className="logo-center" id="logoCenter" ref={logoCenterRef}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="logo-aura"></div>
              <div className="logo-ring-1"></div>
              <div className="logo-ring-2"></div>
              <div className="logo-ring-3"></div>
              <img 
                className="logo-img" 
                id="logoImg" 
                ref={logoImgRef}
                src="/eras-cyber-emblem.jpg" 
                alt="ERAS"
                onMouseMove={handleLogoMouseMove}
                onMouseLeave={handleLogoMouseLeave}
                style={{ pointerEvents: 'auto' }}
              />
            </div>
          </div>

          {/* Right panel (login) */}
          <div className="right">
            <div className="card" id="card" ref={cardRef}>
              <div className="card-glow" id="cardGlow" ref={cardGlowRef}></div>
              <div className="c c-tl"></div><div className="c c-tr"></div>
              <div className="c c-bl"></div><div className="c c-br"></div>

              {mode === 'login' && (
                <>
                  <div className="ch">
                    <div className="ch-eye">Acesso ao Sistema</div>
                    <h2 className="ch-title">Bem-vindo de volta</h2>
                    <p className="ch-sub">Entre com suas credenciais</p>
                  </div>

                  <form onSubmit={handleLogin} noValidate style={{ position: 'relative', zIndex: 10 }}>
                    {isInactivity && !error && (
                      <div className="login-error" style={{ borderColor: 'rgba(245, 158, 11, 0.4)', color: '#fcd34d', background: 'rgba(245, 158, 11, 0.1)' }}>
                        <Clock className="login-error-icon text-amber-400" />
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

                    <div className="fields">
                      <div className="field">
                        <label htmlFor="login-email">E-mail</label>
                        <div className="iw">
                          <svg className="ico" width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                            <rect x="2" y="4" width="20" height="16" rx="3" />
                            <path d="m2 7 10 7 10-7" />
                          </svg>
                          <input
                            type="email"
                            id="login-email"
                            placeholder="seu@email.com"
                            autoComplete="email"
                            value={email}
                            onChange={e => { setEmail(e.target.value); setError(null); }}
                            disabled={isLoading}
                          />
                        </div>
                      </div>
                      <div className="field">
                        <label htmlFor="login-password">Senha</label>
                        <div className="iw">
                          <svg className="ico" width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                            <rect x="3" y="11" width="18" height="11" rx="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                          </svg>
                          <input
                            type={showPassword ? 'text' : 'password'}
                            id="login-password"
                            placeholder="••••••••"
                            autoComplete="current-password"
                            value={password}
                            onChange={e => { setPassword(e.target.value); setError(null); }}
                            disabled={isLoading}
                          />
                          <button
                            className="eyebtn"
                            onClick={() => setShowPassword(v => !v)}
                            type="button"
                            tabIndex={-1}
                          >
                            {showPassword ? (
                              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                                <path d="M17.94 17.94A10 10 0 0 1 12 20c-7 0-11-8-11-8a18 18 0 0 1 5.06-5.94M9.9 4.24A9 9 0 0 1 12 4c7 0 11 8 11 8a18 18 0 0 1-2.16 3.19m-6.72-1.07A3 3 0 1 1 9.88 9.88" />
                                <line x1="1" y1="1" x2="23" y2="23" />
                              </svg>
                            ) : (
                              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                                <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="forgot-row" style={{ justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        className="lnk"
                        onClick={() => { setMode('forgot'); setError(null); }}
                      >
                        Esqueci minha senha
                      </button>
                    </div>

                    <button className="btn" type="submit" disabled={isLoading}>
                      {isLoading ? (
                        <>
                          <span className="btn-spinner" />
                          Entrando...
                        </>
                      ) : (
                        <>
                          <span className="btn-shine"></span>
                          Entrar no Sistema
                          <svg className="barrow" width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path d="M5 12h14M13 6l6 6-6 6" />
                          </svg>
                        </>
                      )}
                    </button>

                    <div className="secbar">
                      <div className="secdot"></div>
                      <p className="sectext"><strong>Conexão segura</strong> · TLS 1.3 · Criptografado</p>
                    </div>
                  </form>
                </>
              )}


              {mode === 'forgot' && (
                <>
                  <div className="ch">
                    <button className="lnk" style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '5px', justifyContent: 'center', width: '100%' }} onClick={() => { setMode('login'); setError(null); setForgotSent(false); }}>
                      <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                      </svg>
                      Voltar ao login
                    </button>
                    <h2 className="ch-title">Recuperar senha</h2>
                    <p className="ch-sub">Informe seu email de acesso</p>
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
                        className="btn"
                        onClick={() => { setMode('login'); setForgotSent(false); }}
                      >
                        Voltar ao login
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleForgotPassword} noValidate style={{ position: 'relative', zIndex: 10 }}>
                      {error && (
                        <div className="login-error" role="alert">
                          <svg viewBox="0 0 20 20" fill="currentColor" className="login-error-icon">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          <span>{error}</span>
                        </div>
                      )}

                      <div className="fields">
                        <div className="field">
                          <label htmlFor="forgot-email">Email cadastrado</label>
                          <div className="iw">
                            <svg className="ico" width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                              <rect x="2" y="4" width="20" height="16" rx="3" />
                              <path d="m2 7 10 7 10-7" />
                            </svg>
                            <input
                              id="forgot-email"
                              type="email"
                              autoComplete="email"
                              placeholder="seu@email.com"
                              value={email}
                              onChange={e => { setEmail(e.target.value); setError(null); }}
                              disabled={isLoading}
                            />
                          </div>
                        </div>
                      </div>

                      <button className="btn" type="submit" disabled={isLoading} style={{ marginTop: '20px' }}>
                        {isLoading ? (
                          <>
                            <span className="btn-spinner" />
                            Enviando...
                          </>
                        ) : (
                          <>
                            <span className="btn-shine"></span>
                            Enviar link
                          </>
                        )}
                      </button>
                    </form>
                  )}
                </>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
