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
    // Dispara evento para sincronizar imediatamente
    window.dispatchEvent(new Event('inactivity_config_changed'));
  } catch (e) {}
};

export const getWarningDurationSeconds = (timeoutMinutes: number): number => {
  if (timeoutMinutes <= 1) return 20; // 20s para teste rápido de 1 minuto
  if (timeoutMinutes <= 2) return 30; // 30s para teste de 2 minutos
  return 60; // 60s para configurações de 5+ minutos
};

export const InactivityManager: React.FC = () => {
  const { session, user, signOut } = useAuth();
  const { state } = useAppContext();
  const navigate = useNavigate();

  const [showWarning, setShowWarning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(60);
  const [maxWarningSeconds, setMaxWarningSeconds] = useState(60);
  
  const lastActivityRef = useRef<number>(Date.now());
  const throttleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLoggingOutRef = useRef(false);

  // Atualiza timestamp de última atividade (com throttle para não sobrecarregar o storage)
  const recordActivity = useCallback(() => {
    if (showWarning || isLoggingOutRef.current) return;
    const now = Date.now();
    lastActivityRef.current = now;

    if (!throttleTimerRef.current) {
      throttleTimerRef.current = setTimeout(() => {
        try {
          localStorage.setItem(INACTIVITY_STORAGE_KEY, String(now));
        } catch (e) {}
        throttleTimerRef.current = null;
      }, 1000);
    }
  }, [showWarning]);

  // Reseta o aviso e restaura o timer
  const handleStayLoggedIn = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    try {
      localStorage.setItem(INACTIVITY_STORAGE_KEY, String(now));
    } catch (e) {}
    setShowWarning(false);
  }, []);

  // Executa o logoff por inatividade
  const handlePerformLogout = useCallback(async () => {
    if (isLoggingOutRef.current) return;
    isLoggingOutRef.current = true;
    setShowWarning(false);

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

  // Listener para eventos de atividade do usuário
  useEffect(() => {
    const isUserAuthenticated = !!session || !!state.user;
    if (!isUserAuthenticated) return;

    // Inicializa timestamp na montagem
    const now = Date.now();
    lastActivityRef.current = now;
    try {
      localStorage.setItem(INACTIVITY_STORAGE_KEY, String(now));
    } catch (e) {}

    const events = [
      'mousedown',
      'mousemove',
      'keydown',
      'touchstart',
      'scroll',
      'wheel',
      'click',
      'focus'
    ];

    const handleUserInteraction = () => {
      recordActivity();
    };

    events.forEach(evt => {
      window.addEventListener(evt, handleUserInteraction, { passive: true, capture: true });
      document.addEventListener(evt, handleUserInteraction, { passive: true, capture: true });
    });

    // Sincronização entre abas do navegador via Storage Event
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === INACTIVITY_STORAGE_KEY && e.newValue) {
        const remoteTime = parseInt(e.newValue, 10);
        if (!isNaN(remoteTime) && remoteTime > lastActivityRef.current) {
          lastActivityRef.current = remoteTime;
          if (showWarning) {
            setShowWarning(false);
          }
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      events.forEach(evt => {
        window.removeEventListener(evt, handleUserInteraction, { capture: true });
        document.removeEventListener(evt, handleUserInteraction, { capture: true });
      });
      window.removeEventListener('storage', handleStorageChange);
      if (throttleTimerRef.current) clearTimeout(throttleTimerRef.current);
    };
  }, [session, state.user, showWarning, recordActivity]);

  // Timer de verificação periódica de inatividade (roda a cada segundo)
  useEffect(() => {
    const isUserAuthenticated = !!session || !!state.user;
    if (!isUserAuthenticated) {
      if (showWarning) setShowWarning(false);
      return;
    }

    const interval = setInterval(() => {
      if (isLoggingOutRef.current) return;

      const now = Date.now();
      
      // Lê última atividade sincronizada
      let lastAct = lastActivityRef.current;
      try {
        const stored = localStorage.getItem(INACTIVITY_STORAGE_KEY);
        if (stored) {
          const parsed = parseInt(stored, 10);
          if (!isNaN(parsed) && parsed > 0) {
            // Se o timestamp for no futuro ou muito no passado (ex: login novo), atualiza
            if (parsed > lastAct) {
              lastAct = parsed;
              lastActivityRef.current = parsed;
            }
          }
        }
      } catch (e) {}

      const timeoutMinutes = getInactivityTimeoutMinutes();
      const totalTimeoutMs = timeoutMinutes * 60 * 1000;
      const warningSeconds = getWarningDurationSeconds(timeoutMinutes);
      const warningThresholdMs = totalTimeoutMs - (warningSeconds * 1000);
      const elapsed = now - lastAct;

      setMaxWarningSeconds(warningSeconds);

      if (elapsed >= totalTimeoutMs) {
        // Tempo totalmente esgotado -> Executa logoff
        handlePerformLogout();
      } else if (elapsed >= warningThresholdMs) {
        // Entrou na janela de aviso prévio
        const remainingSeconds = Math.max(1, Math.ceil((totalTimeoutMs - elapsed) / 1000));
        setShowWarning(true);
        setSecondsRemaining(remainingSeconds);
      } else {
        // Usuário está ativo dentro do limite seguro
        if (showWarning) {
          setShowWarning(false);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
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
