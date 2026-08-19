import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, LogOut, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAppContext } from '../../context/AppContext';
import { registrarAuditoria } from '../../lib/supabase';

// Chaves de armazenamento
export const INACTIVITY_STORAGE_KEY = 'eras_last_activity';
export const INACTIVITY_TIMEOUT_CONFIG_KEY = 'eras_inactivity_timeout_minutes';
export const DEFAULT_INACTIVITY_MINUTES = 15; // 15 minutos padrão

export const getInactivityTimeoutMinutes = (): number => {
  try {
    const saved = localStorage.getItem(INACTIVITY_TIMEOUT_CONFIG_KEY);
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
  } catch (e) {}
  return DEFAULT_INACTIVITY_MINUTES;
};

export const setInactivityTimeoutMinutes = (minutes: number) => {
  try {
    localStorage.setItem(INACTIVITY_TIMEOUT_CONFIG_KEY, String(minutes));
    window.dispatchEvent(new CustomEvent('inactivity_config_changed', { detail: minutes }));
  } catch (e) {}
};

export const getWarningDurationSeconds = (timeoutMinutes: number): number => {
  if (timeoutMinutes <= 1) return 20; // 20s para teste de 1 minuto (aviso aparece aos 40s)
  if (timeoutMinutes <= 2) return 30; // 30s para teste de 2 minutos (aviso aparece aos 90s)
  return 60; // 60s padrão para 5+ minutos
};

export const InactivityManager: React.FC = () => {
  const { session, user, signOut } = useAuth();
  const { state } = useAppContext();
  const navigate = useNavigate();

  const [showWarning, setShowWarning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(60);
  const [maxWarningSeconds, setMaxWarningSeconds] = useState(60);

  const lastActivityRef = useRef<number>(Date.now());
  const isLoggingOutRef = useRef(false);
  const showWarningRef = useRef(false);

  // Mantém showWarningRef sincronizado sem forçar re-render do listener
  useEffect(() => {
    showWarningRef.current = showWarning;
  }, [showWarning]);

  // Reseta o aviso e restaura o timer
  const handleStayLoggedIn = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    try {
      localStorage.setItem(INACTIVITY_STORAGE_KEY, String(now));
    } catch (e) {}
    setShowWarning(false);
    showWarningRef.current = false;
  }, []);

  // Executa o logoff por inatividade
  const handlePerformLogout = useCallback(async () => {
    if (isLoggingOutRef.current) return;
    isLoggingOutRef.current = true;
    setShowWarning(false);
    showWarningRef.current = false;

    try {
      sessionStorage.setItem('eras_logout_reason', 'inactivity');
    } catch (e) {}

    try {
      if (user?.email) {
        await registrarAuditoria('Logoff por Inatividade', {
          usuario_id: user?.id,
          usuario_email: user?.email,
          motivo: 'Inatividade do usuário',
          data: new Date().toISOString()
        });
      }
    } catch (e) {
      console.warn('Erro ao registrar auditoria de inatividade:', e);
    }

    try {
      await signOut();
    } catch (e) {
      console.error('Erro ao efetuar signOut:', e);
    }

    navigate('/login?reason=inactivity', { replace: true });
    isLoggingOutRef.current = false;
  }, [user, signOut, navigate]);

  // Inicialização e captura contínua de eventos de atividade (executado uma única vez por sessão)
  useEffect(() => {
    const isAuthenticated = !!session || !!state.user;
    if (!isAuthenticated) return;

    // Inicializa o timestamp apenas se não existir ou se for inválido
    const stored = localStorage.getItem(INACTIVITY_STORAGE_KEY);
    const parsed = stored ? parseInt(stored, 10) : 0;
    const now = Date.now();

    if (!parsed || isNaN(parsed) || parsed > now || (now - parsed > getInactivityTimeoutMinutes() * 60 * 1000)) {
      lastActivityRef.current = now;
      try {
        localStorage.setItem(INACTIVITY_STORAGE_KEY, String(now));
      } catch (e) {}
    } else {
      lastActivityRef.current = parsed;
    }

    // Handler de eventos de atividade do usuário
    const onUserActivity = () => {
      // Se o modal de aviso estiver aberto, não reseta automaticamente pelo mousemove (exige clique explícito)
      if (showWarningRef.current || isLoggingOutRef.current) return;

      const currentTime = Date.now();
      // Throttle de 1 segundo para gravação no localStorage
      if (currentTime - lastActivityRef.current >= 1000) {
        lastActivityRef.current = currentTime;
        try {
          localStorage.setItem(INACTIVITY_STORAGE_KEY, String(currentTime));
        } catch (e) {}
      }
    };

    const events = [
      'mousedown',
      'mousemove',
      'keydown',
      'touchstart',
      'scroll',
      'wheel',
      'click'
    ];

    events.forEach(evt => {
      window.addEventListener(evt, onUserActivity, { passive: true, capture: true });
      document.addEventListener(evt, onUserActivity, { passive: true, capture: true });
    });

    // Sincronização entre múltiplas abas via storage event
    const onStorageChange = (e: StorageEvent) => {
      if (e.key === INACTIVITY_STORAGE_KEY && e.newValue) {
        const remoteTime = parseInt(e.newValue, 10);
        if (!isNaN(remoteTime) && remoteTime > lastActivityRef.current) {
          lastActivityRef.current = remoteTime;
          if (showWarningRef.current) {
            setShowWarning(false);
            showWarningRef.current = false;
          }
        }
      }
    };
    window.addEventListener('storage', onStorageChange);

    return () => {
      events.forEach(evt => {
        window.removeEventListener(evt, onUserActivity, { capture: true });
        document.removeEventListener(evt, onUserActivity, { capture: true });
      });
      window.removeEventListener('storage', onStorageChange);
    };
  }, [session?.user?.id, state.user?.id]);

  // Loop de verificação de inatividade (a cada 1 segundo)
  useEffect(() => {
    const isAuthenticated = !!session || !!state.user;
    if (!isAuthenticated) {
      if (showWarning) setShowWarning(false);
      return;
    }

    const intervalId = setInterval(() => {
      if (isLoggingOutRef.current) return;

      const now = Date.now();

      // Verifica se houve atividade recente em outra aba
      try {
        const stored = localStorage.getItem(INACTIVITY_STORAGE_KEY);
        if (stored) {
          const parsed = parseInt(stored, 10);
          if (!isNaN(parsed) && parsed > lastActivityRef.current && parsed <= now) {
            lastActivityRef.current = parsed;
          }
        }
      } catch (e) {}

      const timeoutMinutes = getInactivityTimeoutMinutes();
      const totalTimeoutMs = timeoutMinutes * 60 * 1000;
      const warningSeconds = getWarningDurationSeconds(timeoutMinutes);
      const warningThresholdMs = totalTimeoutMs - (warningSeconds * 1000);
      const elapsed = now - lastActivityRef.current;

      setMaxWarningSeconds(warningSeconds);

      if (elapsed >= totalTimeoutMs) {
        // Tempo totalmente esgotado -> Desconecta imediatamente
        handlePerformLogout();
      } else if (elapsed >= warningThresholdMs) {
        // Janela de aviso prévio com contagem regressiva
        const remaining = Math.max(1, Math.ceil((totalTimeoutMs - elapsed) / 1000));
        setShowWarning(true);
        setSecondsRemaining(remaining);
      } else {
        // Usuário dentro do período ativo seguro
        if (showWarning) {
          setShowWarning(false);
        }
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [session, state.user, showWarning, handlePerformLogout]);

  if (!showWarning || (!session && !state.user)) {
    return null;
  }

  const progressPercentage = Math.min(100, Math.max(0, (secondsRemaining / maxWarningSeconds) * 100));

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-[#0A0C16]/85 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 15 }}
          transition={{ duration: 0.2 }}
          className="bg-[#181B34] rounded-3xl shadow-2xl w-full max-w-md border border-amber-500/30 overflow-hidden relative"
        >
          {/* Barra de Progresso Superior */}
          <div className="w-full bg-[#101223] h-1.5 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-rose-500 transition-all duration-1000 ease-linear"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>

          <div className="p-6 pt-7 flex flex-col items-center text-center">
            {/* Ícone Pulsante */}
            <div className="relative mb-4">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Clock className="w-8 h-8 animate-pulse" />
              </div>
              <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center text-[10px] font-bold shadow-lg">
                !
              </div>
            </div>

            <h3 className="text-xl font-bold text-white mb-2 tracking-tight">
              Sessão Expirando por Inatividade
            </h3>

            <p className="text-slate-300 text-sm leading-relaxed mb-4">
              Detectamos que você está inativo há algum tempo. Por segurança, sua sessão será encerrada automaticamente em:
            </p>

            {/* Contador em Destaque */}
            <div className="bg-[#101223] border border-[#262A45] rounded-2xl py-3 px-6 mb-4 flex items-center justify-center gap-2">
              <span className="text-3xl font-extrabold text-amber-400 font-mono">
                {secondsRemaining < 10 ? `0${secondsRemaining}` : secondsRemaining}
              </span>
              <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">
                segundos
              </span>
            </div>

            <p className="text-xs text-slate-400">
              Deseja continuar conectado ao sistema ou encerrar sua sessão agora?
            </p>
          </div>

          {/* Botões de Ação */}
          <div className="px-6 py-4 bg-[#101223]/50 border-t border-[#262A45] flex flex-col sm:flex-row items-center justify-end gap-3 rounded-b-3xl">
            <button
              type="button"
              onClick={handlePerformLogout}
              className="w-full sm:w-auto px-4 py-2.5 bg-[#222542] border border-[#2A2D48] text-slate-300 rounded-xl font-medium hover:bg-rose-500/20 hover:text-rose-400 hover:border-rose-500/30 transition-colors text-sm flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sair Agora
            </button>
            <button
              type="button"
              onClick={handleStayLoggedIn}
              className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-[#7E4CF3] to-[#4A88E9] text-white rounded-xl font-semibold hover:opacity-95 transition-all text-sm shadow-lg shadow-[#7E4CF3]/25 flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              Continuar Conectado
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
