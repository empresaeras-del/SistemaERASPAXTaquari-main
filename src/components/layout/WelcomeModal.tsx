import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  X, 
  Layers, 
  TrendingUp, 
  TrendingDown, 
  ArrowRight, 
  ShieldCheck, 
  Cake, 
  PartyPopper, 
  Sparkles, 
  MessageCircle, 
  User, 
  Users, 
  Check, 
  Copy, 
  Search, 
  Calendar,
  Building2,
  GraduationCap,
  BookOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppContext } from '../../context/AppContext';
import { getLoteAbertoAtivo } from '../../services/caixasService';
import { getParcelasReceber, getParcelasPagar, ParcelaReceber, ParcelaPagar } from '../../services/financeiroService';
import { getAssociados, Associado } from '../../services/associadosService';
import { getEmpresaById, Empresa } from '../../services/empresasService';
import { format, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { sendWhatsAppMessage } from '../../utils/whatsapp';
import toast from 'react-hot-toast';

export interface AniversarianteItem {
  id: string;
  nome: string;
  tipo: 'titular' | 'dependente';
  parentesco?: string;
  titularNome?: string;
  contratoNumero?: string;
  dataNascimento: string;
  dia: number;
  mes: number;
  ano?: number;
  idade?: number;
  isHoje: boolean;
  telefone?: string;
}

export const WelcomeModal = () => {
  const { state } = useAppContext();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'operacao' | 'aniversariantes'>('operacao');

  const handleAbrirTutorial = () => {
    setIsOpen(false);
    navigate('/tutorial');
  };
  
  const [caixaStatus, setCaixaStatus] = useState<any>(null);
  const [receberHoje, setReceberHoje] = useState<ParcelaReceber[]>([]);
  const [pagarHoje, setPagarHoje] = useState<ParcelaPagar[]>([]);
  const [aniversariantes, setAniversariantes] = useState<AniversarianteItem[]>([]);
  const [empresaAtiva, setEmpresaAtiva] = useState<Empresa | null>(null);

  // Filtros da aba de aniversariantes
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'hoje' | 'titular' | 'dependente'>('todos');
  const [termoBusca, setTermoBusca] = useState('');
  const [copiadoId, setCopiadoId] = useState<string | null>(null);

  const mesAtualNome = useMemo(() => {
    return format(new Date(), 'MMMM', { locale: ptBR });
  }, []);

  const extrairAniversariantes = (associados: Associado[]): AniversarianteItem[] => {
    const hoje = new Date();
    const mesAtual = hoje.getMonth() + 1; // 1-12
    const diaAtual = hoje.getDate();
    const anoAtual = hoje.getFullYear();

    const resultado: AniversarianteItem[] = [];

    const parseDataNascimento = (dateStr?: string) => {
      if (!dateStr || typeof dateStr !== 'string') return null;
      const clean = dateStr.trim().split('T')[0];

      // Formato YYYY-MM-DD
      if (clean.includes('-')) {
        const parts = clean.split('-');
        if (parts.length >= 3) {
          const ano = parseInt(parts[0], 10);
          const mes = parseInt(parts[1], 10);
          const dia = parseInt(parts[2], 10);
          if (!isNaN(dia) && !isNaN(mes) && mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31) {
            return { dia, mes, ano: !isNaN(ano) ? ano : undefined };
          }
        }
      }

      // Formato DD/MM/YYYY
      if (clean.includes('/')) {
        const parts = clean.split('/');
        if (parts.length >= 2) {
          const dia = parseInt(parts[0], 10);
          const mes = parseInt(parts[1], 10);
          const ano = parts.length >= 3 ? parseInt(parts[2], 10) : undefined;
          if (!isNaN(dia) && !isNaN(mes) && mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31) {
            return { dia, mes, ano: ano && !isNaN(ano) ? ano : undefined };
          }
        }
      }

      return null;
    };

    for (const assoc of associados) {
      if (assoc.deleted_at || assoc.status === 'encerrado') continue;

      // 1. Titular
      if (assoc.data_nascimento) {
        const parsed = parseDataNascimento(assoc.data_nascimento);
        if (parsed && parsed.mes === mesAtual) {
          const idade = parsed.ano ? anoAtual - parsed.ano : undefined;
          resultado.push({
            id: `titular-${assoc.id}`,
            nome: assoc.nome,
            tipo: 'titular',
            contratoNumero: assoc.numero_contrato,
            dataNascimento: assoc.data_nascimento,
            dia: parsed.dia,
            mes: parsed.mes,
            ano: parsed.ano,
            idade,
            isHoje: parsed.dia === diaAtual,
            telefone: assoc.telefone
          });
        }
      }

      // 2. Dependentes
      if (assoc.dependentes && Array.isArray(assoc.dependentes)) {
        for (const dep of assoc.dependentes) {
          if (dep && dep.data_nascimento) {
            const parsed = parseDataNascimento(dep.data_nascimento);
            if (parsed && parsed.mes === mesAtual) {
              const idade = parsed.ano ? anoAtual - parsed.ano : undefined;
              resultado.push({
                id: `dep-${dep.id || dep.nome}-${assoc.id}`,
                nome: dep.nome,
                tipo: 'dependente',
                parentesco: dep.parentesco,
                titularNome: assoc.nome,
                contratoNumero: assoc.numero_contrato,
                dataNascimento: dep.data_nascimento,
                dia: parsed.dia,
                mes: parsed.mes,
                ano: parsed.ano,
                idade,
                isHoje: parsed.dia === diaAtual,
                telefone: assoc.telefone
              });
            }
          }
        }
      }
    }

    // Ordenação: primeiro os que fazem aniversário hoje, depois pelo dia do mês crescente
    return resultado.sort((a, b) => {
      if (a.isHoje && !b.isHoje) return -1;
      if (!a.isHoje && b.isHoje) return 1;
      return a.dia - b.dia;
    });
  };

  const loadData = async () => {
    if (!state.empresaSelecionada || !state.user) return;
    setLoading(true);
    try {
      const [lote, parcelasReceber, parcelasPagar, associados, empresa] = await Promise.all([
        getLoteAbertoAtivo(state.isOnline, state.empresaSelecionada),
        getParcelasReceber(state.isOnline, state.empresaSelecionada),
        getParcelasPagar(state.isOnline, state.empresaSelecionada),
        getAssociados(state.isOnline, state.empresaSelecionada),
        getEmpresaById(state.empresaSelecionada || 'default_tenant', state.isOnline)
      ]);

      setCaixaStatus(lote);
      if (empresa) setEmpresaAtiva(empresa);
      
      const hojeReceber = (parcelasReceber || []).filter(p => p.status === 'pendente' && p.data_vencimento && isToday(new Date(p.data_vencimento + 'T12:00:00')));
      const hojePagar = (parcelasPagar || []).filter(p => p.status === 'pendente' && p.data_vencimento && isToday(new Date(p.data_vencimento + 'T12:00:00')));
      
      setReceberHoje(hojeReceber);
      setPagarHoje(hojePagar);

      const listaAniversariantes = extrairAniversariantes(associados || []);
      setAniversariantes(listaAniversariantes);
    } catch (error) {
      console.error("Erro ao carregar dados do welcome modal:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const hasSeen = sessionStorage.getItem('has_seen_welcome_modal');
    if (!hasSeen && state.empresaSelecionada && state.user) {
      loadData().then(() => {
        setIsOpen(true);
        sessionStorage.setItem('has_seen_welcome_modal', 'true');
      });
    }
  }, [state.empresaSelecionada, state.isOnline, state.user]);

  useEffect(() => {
    const handleOpen = () => {
      loadData().then(() => setIsOpen(true));
    };
    window.addEventListener('open-welcome-modal', handleOpen);
    return () => window.removeEventListener('open-welcome-modal', handleOpen);
  }, [state.empresaSelecionada, state.isOnline, state.user]);

  // Tecla ESC para fechar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const aniversariantesHoje = useMemo(() => {
    return aniversariantes.filter(a => a.isHoje);
  }, [aniversariantes]);

  const aniversariantesFiltrados = useMemo(() => {
    return aniversariantes.filter(item => {
      // Filtro por tipo
      if (filtroTipo === 'hoje' && !item.isHoje) return false;
      if (filtroTipo === 'titular' && item.tipo !== 'titular') return false;
      if (filtroTipo === 'dependente' && item.tipo !== 'dependente') return false;

      // Filtro por busca
      if (termoBusca.trim()) {
        const busca = termoBusca.toLowerCase();
        const matchNome = item.nome.toLowerCase().includes(busca);
        const matchTitular = item.titularNome?.toLowerCase().includes(busca);
        const matchContrato = item.contratoNumero?.toLowerCase().includes(busca);
        if (!matchNome && !matchTitular && !matchContrato) return false;
      }

      return true;
    });
  }, [aniversariantes, filtroTipo, termoBusca]);

  const handleEnviarMensagem = (item: AniversarianteItem) => {
    if (!item.telefone) {
      toast.error('Telefone não cadastrado para este associado.');
      return;
    }
    const nomeEmpresa = empresaAtiva?.nome_fantasia || 'ERAS PAX';
    const primeiroNome = item.nome.split(' ')[0];
    const mensagem = `Olá, ${primeiroNome}! 🎉🎂\n\nA equipe da *${nomeEmpresa}* deseja a você um *Feliz Aniversário*!\nQue seu dia seja repleto de alegria, saúde, paz e muitas realizações! Conte sempre conosco.`;
    
    sendWhatsAppMessage(item.telefone, mensagem);
  };

  const handleCopiarTelefone = (item: AniversarianteItem) => {
    if (!item.telefone) return;
    navigator.clipboard.writeText(item.telefone);
    setCopiadoId(item.id);
    toast.success('Telefone copiado para a área de transferência!');
    setTimeout(() => setCopiadoId(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-3xl bg-bg-base rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-border-default z-10"
        >
          {/* Header */}
          <div className="bg-bg-subtle p-6 sm:p-8 flex flex-col items-center justify-center border-b border-border-default relative overflow-hidden shrink-0">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-purple-600/5 to-transparent pointer-events-none" />
            
            <button
              onClick={handleAbrirTutorial}
              className="absolute left-4 top-4 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all z-20 shadow-sm"
              title="Abrir Tutorial do Sistema"
            >
              <GraduationCap className="w-4 h-4 text-blue-500" />
              <span className="hidden sm:inline">Tutorial & Guia</span>
            </button>

            <button
              onClick={() => setIsOpen(false)}
              className="absolute right-4 top-4 p-2 text-text-subtle hover:text-text-base hover:bg-bg-hover rounded-xl transition-colors z-20"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>

            {empresaAtiva?.logo_url ? (
              <img 
                src={empresaAtiva.logo_url} 
                alt="Logo da Empresa" 
                className="h-16 max-w-[200px] object-contain z-10 mb-3 drop-shadow-md" 
              />
            ) : (
              <div className="w-14 h-14 bg-blue-600/10 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mb-3 z-10 shadow-lg border border-blue-500/20">
                <ShieldCheck className="w-7 h-7" />
              </div>
            )}
            
            <h2 className="text-2xl sm:text-3xl font-bold text-text-base z-10 text-center tracking-tight">
              Bem-vindo(a), {state.user?.nome?.split(' ')[0] || 'Usuário'}!
            </h2>
            
            <div className="flex flex-wrap items-center justify-center gap-2 mt-2 z-10">
              <span className="text-text-subtle text-xs sm:text-sm capitalize flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-500" />
                {format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </span>
              {empresaAtiva?.nome_fantasia && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  <Building2 className="w-3 h-3" />
                  {empresaAtiva.nome_fantasia}
                </span>
              )}
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-border-default px-6 bg-bg-surface shrink-0">
            <button
              onClick={() => setActiveTab('operacao')}
              className={`px-4 py-3 font-semibold text-sm border-b-2 transition-all flex items-center gap-2 ${
                activeTab === 'operacao'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-text-subtle hover:text-text-base'
              }`}
            >
              <Layers className="w-4 h-4" />
              Resumo Operacional
            </button>

            <button
              onClick={() => setActiveTab('aniversariantes')}
              className={`px-4 py-3 font-semibold text-sm border-b-2 transition-all flex items-center gap-2 relative ${
                activeTab === 'aniversariantes'
                  ? 'border-amber-500 text-amber-500'
                  : 'border-transparent text-text-subtle hover:text-text-base'
              }`}
            >
              <Cake className="w-4 h-4" />
              <span>Aniversariantes do Mês</span>
              {aniversariantes.length > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                  aniversariantesHoje.length > 0 
                    ? 'bg-amber-500 text-white animate-pulse' 
                    : 'bg-bg-subtle text-text-subtle border border-border-default'
                }`}>
                  {aniversariantes.length}
                </span>
              )}
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
            {loading ? (
              <div className="py-16 flex flex-col items-center justify-center gap-3">
                <div className="w-9 h-9 rounded-full border-3 border-blue-500/20 border-t-blue-600 animate-spin" />
                <span className="text-xs text-text-subtle font-medium">Carregando informações do dia...</span>
              </div>
            ) : activeTab === 'operacao' ? (
              <div className="space-y-4">
                {/* Banner de Acesso ao Novo Módulo de Tutorial Completo */}
                <div 
                  onClick={handleAbrirTutorial}
                  className="cursor-pointer p-4 rounded-2xl bg-gradient-to-r from-blue-600/15 via-indigo-600/10 to-violet-600/15 border border-blue-500/30 hover:border-blue-500/60 transition-all flex items-center justify-between group shadow-sm"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform">
                      <GraduationCap className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-text-base flex items-center gap-1.5">
                          Tutorial & Guia do Sistema
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white uppercase tracking-wider shadow-sm">
                            NOVO
                          </span>
                        </h4>
                      </div>
                      <p className="text-xs text-text-subtle mt-0.5">
                        Aprenda o passo a passo de associados, contratos, óbitos, guias, caixas e faturamento.
                      </p>
                    </div>
                  </div>

                  <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 group-hover:translate-x-1 transition-transform flex items-center gap-1 shrink-0 ml-2">
                    Abrir Guia <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>

                {/* Banner de Aniversariantes do Mês */}
                {aniversariantes.length > 0 && (
                  <div 
                    onClick={() => setActiveTab('aniversariantes')}
                    className="cursor-pointer p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-blue-500/10 border border-amber-500/30 hover:border-amber-500/50 transition-all flex items-center justify-between group shadow-sm"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
                        {aniversariantesHoje.length > 0 ? (
                          <PartyPopper className="w-5 h-5 animate-bounce" />
                        ) : (
                          <Cake className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-text-base">
                            Aniversariantes de {mesAtualNome}
                          </h4>
                          {aniversariantesHoje.length > 0 && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500 text-white uppercase tracking-wider shadow-sm">
                              {aniversariantesHoje.length} {aniversariantesHoje.length === 1 ? 'HOJE' : 'HOJE'} 🎉
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-text-subtle mt-0.5">
                          {aniversariantes.length} {aniversariantes.length === 1 ? 'pessoa comemora' : 'pessoas comemoram'} aniversário neste mês. Clique para ver e parabenizar.
                        </p>
                      </div>
                    </div>

                    <span className="text-xs font-semibold text-amber-500 group-hover:translate-x-1 transition-transform flex items-center gap-1 shrink-0">
                      Ver Lista <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Caixa Status */}
                  <div className={`p-5 rounded-2xl border ${caixaStatus ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'} flex flex-col justify-between`}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`p-2.5 rounded-xl ${caixaStatus ? 'bg-emerald-500/20 text-emerald-500' : 'bg-amber-500/20 text-amber-500'}`}>
                        <Layers className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-text-base text-sm">Situação do Caixa</h3>
                        <span className="text-[11px] text-text-subtle">Controle diário do terminal</span>
                      </div>
                    </div>
                    <div>
                      {caixaStatus ? (
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                            <p className="text-emerald-500 dark:text-emerald-400 font-bold text-lg">Caixa Aberto</p>
                          </div>
                          <p className="text-xs text-text-subtle">Terminal: <span className="font-semibold text-text-base">{caixaStatus.terminal_caixa}</span></p>
                          <p className="text-xs text-text-subtle mt-0.5">Aberto às: <span className="font-semibold text-text-base">{format(new Date(caixaStatus.data_abertura), 'HH:mm')}</span></p>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                            <p className="text-amber-500 font-bold text-lg">Caixa Fechado</p>
                          </div>
                          <p className="text-xs text-text-subtle">Não há lote em aberto. Abra um caixa para receber valores.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Receber Hoje */}
                  <div className="p-5 rounded-2xl bg-bg-surface border border-border-default flex flex-col justify-between shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        <TrendingUp className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-text-base text-sm">Contas a Receber</h3>
                        <span className="text-[11px] text-text-subtle">Vencimentos do dia</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-2xl font-black text-text-base tracking-tight mb-1">
                        {receberHoje.length} <span className="text-xs font-normal text-text-subtle">parcelas</span>
                      </p>
                      <p className="text-sm font-bold text-emerald-500 dark:text-emerald-400">
                        R$ {receberHoje.reduce((acc, curr) => acc + (curr.valor || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>

                  {/* Pagar Hoje */}
                  <div className="p-5 rounded-2xl bg-bg-surface border border-border-default flex flex-col justify-between md:col-span-2 shadow-sm">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-500">
                          <TrendingDown className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-text-base text-sm">Contas a Pagar (Hoje)</h3>
                          <span className="text-[11px] text-text-subtle">Compromissos e despesas para hoje</span>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-rose-500 bg-rose-500/10 px-2.5 py-1 rounded-lg border border-rose-500/20">
                        {pagarHoje.length} {pagarHoje.length === 1 ? 'pendência' : 'pendências'}
                      </span>
                    </div>
                    <div className="flex justify-between items-end pt-2 border-t border-border-default/50">
                      <p className="text-sm text-text-subtle">Total previsto para liquidação:</p>
                      <p className="text-xl font-black text-rose-500">
                        R$ {pagarHoje.reduce((acc, curr) => acc + (curr.valor || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Aba: Aniversariantes do Mês */
              <div className="space-y-4">
                {/* Header da Aba com Filtros e Busca */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-bg-surface p-3.5 rounded-2xl border border-border-default">
                  {/* Chips de Filtro */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setFiltroTipo('todos')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                        filtroTipo === 'todos'
                          ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                          : 'bg-bg-subtle text-text-subtle hover:text-text-base'
                      }`}
                    >
                      Todos ({aniversariantes.length})
                    </button>
                    {aniversariantesHoje.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setFiltroTipo('hoje')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1 ${
                          filtroTipo === 'hoje'
                            ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/20'
                            : 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20'
                        }`}
                      >
                        <Sparkles className="w-3 h-3" />
                        Hoje ({aniversariantesHoje.length})
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setFiltroTipo('titular')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                        filtroTipo === 'titular'
                          ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                          : 'bg-bg-subtle text-text-subtle hover:text-text-base'
                      }`}
                    >
                      Titulares ({aniversariantes.filter(a => a.tipo === 'titular').length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFiltroTipo('dependente')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                        filtroTipo === 'dependente'
                          ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                          : 'bg-bg-subtle text-text-subtle hover:text-text-base'
                      }`}
                    >
                      Dependentes ({aniversariantes.filter(a => a.tipo === 'dependente').length})
                    </button>
                  </div>

                  {/* Input de Busca */}
                  <div className="relative min-w-[200px]">
                    <Search className="w-4 h-4 text-text-subtle absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={termoBusca}
                      onChange={e => setTermoBusca(e.target.value)}
                      placeholder="Buscar aniversariante..."
                      className="w-full pl-9 pr-3 py-1.5 bg-bg-base border border-border-default rounded-xl text-xs text-text-base focus:ring-2 focus:ring-blue-500/50 outline-none uppercase"
                    />
                  </div>
                </div>

                {/* Lista de Aniversariantes */}
                {aniversariantesFiltrados.length === 0 ? (
                  <div className="py-12 text-center bg-bg-surface rounded-2xl border border-border-default border-dashed flex flex-col items-center justify-center p-6">
                    <Cake className="w-10 h-10 text-text-subtle/50 mb-2" />
                    <h4 className="text-sm font-bold text-text-base">Nenhum aniversariante encontrado</h4>
                    <p className="text-xs text-text-subtle mt-1 max-w-sm">
                      {termoBusca.trim() 
                        ? 'Nenhum aniversariante corresponde ao termo pesquisado.' 
                        : `Não há aniversários registrados para o filtro selecionado no mês de ${mesAtualNome}.`}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto pr-1 custom-scrollbar">
                    {aniversariantesFiltrados.map((item) => (
                      <div
                        key={item.id}
                        className={`p-4 rounded-2xl border transition-all flex flex-col justify-between relative overflow-hidden ${
                          item.isHoje
                            ? 'bg-gradient-to-br from-amber-500/10 via-bg-surface to-amber-500/5 border-amber-500/40 shadow-md ring-1 ring-amber-500/20'
                            : 'bg-bg-surface border-border-default hover:border-blue-500/30'
                        }`}
                      >
                        {item.isHoje && (
                          <div className="absolute -right-12 top-4 rotate-45 bg-amber-500 text-white font-black text-[9px] py-0.5 px-12 tracking-widest uppercase shadow-sm">
                            HOJE!
                          </div>
                        )}

                        <div>
                          <div className="flex items-start gap-3">
                            {/* Avatar / Dia */}
                            <div className={`w-11 h-11 rounded-2xl flex flex-col items-center justify-center shrink-0 font-bold border ${
                              item.isHoje
                                ? 'bg-amber-500 text-white border-amber-400 shadow-md shadow-amber-500/30'
                                : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                            }`}>
                              <span className="text-[9px] uppercase tracking-tighter leading-none">DIA</span>
                              <span className="text-base font-black leading-none mt-0.5">{item.dia.toString().padStart(2, '0')}</span>
                            </div>

                            <div className="flex-1 min-w-0 pr-6">
                              <h4 className="font-bold text-sm text-text-base truncate" title={item.nome}>
                                {item.nome}
                              </h4>
                              
                              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                                  item.tipo === 'titular'
                                    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                                    : 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
                                }`}>
                                  {item.tipo === 'titular' ? <User className="w-2.5 h-2.5" /> : <Users className="w-2.5 h-2.5" />}
                                  {item.tipo === 'titular' ? 'Titular' : (item.parentesco || 'Dependente')}
                                </span>

                                {item.idade !== undefined && (
                                  <span className="text-[11px] text-text-subtle font-medium">
                                    • {item.idade} anos
                                  </span>
                                )}
                              </div>

                              {item.tipo === 'dependente' && item.titularNome && (
                                <p className="text-[11px] text-text-subtle truncate mt-1" title={`Titular: ${item.titularNome}`}>
                                  Titular: <span className="font-medium text-text-base">{item.titularNome}</span>
                                </p>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Ações Rápidas de Felicitação */}
                        <div className="flex items-center justify-between gap-2 pt-3 mt-3 border-t border-border-default/50">
                          <div className="text-[11px] text-text-subtle truncate">
                            {item.telefone ? (
                              <span className="font-mono text-text-base font-medium">{item.telefone}</span>
                            ) : (
                              <span className="text-text-subtle italic">Sem telefone cadastrado</span>
                            )}
                          </div>

                          {item.telefone && (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleCopiarTelefone(item)}
                                className="p-1.5 text-text-subtle hover:text-text-base hover:bg-bg-hover rounded-lg transition-colors"
                                title="Copiar Telefone"
                              >
                                {copiadoId === item.id ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleEnviarMensagem(item)}
                                className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all active:scale-95"
                                title="Enviar Parabéns no WhatsApp"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                <span>Parabenizar</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 sm:p-6 border-t border-border-default flex flex-col sm:flex-row items-center justify-between gap-3 bg-bg-base shrink-0">
            <div className="text-xs text-text-subtle hidden sm:block">
              {activeTab === 'operacao' ? (
                <span>Visão geral do dia • Clique na aba de aniversariantes para felicitações</span>
              ) : (
                <span>Aniversariantes identificados a partir das datas de nascimento dos cadastros</span>
              )}
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end flex-wrap sm:flex-nowrap">
              <button 
                type="button"
                onClick={handleAbrirTutorial}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/25 rounded-xl font-semibold text-sm shadow-sm transition-all active:scale-95"
                title="Abrir Central de Tutorial e Treinamento do Sistema"
              >
                <GraduationCap className="w-4 h-4 text-blue-500" />
                <span>Tutorial Completo</span>
              </button>

              <button 
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 text-sm text-text-subtle hover:text-text-base hover:bg-bg-hover rounded-xl font-medium transition-colors"
              >
                Fechar
              </button>

              <button 
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/25 transition-all active:scale-95"
              >
                <span>Iniciar Operação</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
