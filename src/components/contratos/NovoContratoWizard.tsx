import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAppContext } from '../../context/AppContext';
import { usePlanosPax } from '../../hooks/usePlanosPax';
import { getAssociados, saveAssociado, Associado } from '../../services/associadosService';
import { salvarReceita } from '../../services/financeiroService';
import { registrarAuditoria } from '../../lib/supabase';
import { X, Search, FileText, Calendar, DollarSign, CheckCircle2, ChevronRight, User } from 'lucide-react';
import { format } from 'date-fns';
import { useConfirm } from '../../context/ConfirmContext';
import { v4 as uuidv4 } from 'uuid';
import { BotaoSalvar } from '../common/BotaoSalvar';

export const NovoContratoWizard: React.FC<{
  onClose: () => void;
  onSuccess: () => void;
  associadoInicial?: Associado;
}> = ({ onClose, onSuccess, associadoInicial }) => {
  const { state } = useAppContext();
  const { confirm } = useConfirm();
  const { planosAtivos: planos, calcularValor, planos: planosCompletos } = usePlanosPax();
  const [associados, setAssociados] = useState<Associado[]>([]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(associadoInicial ? 2 : 1);
  const [searchTerm, setSearchTerm] = useState('');

  // Formulário
  const [selectedAssociado, setSelectedAssociado] = useState<Associado | undefined>(associadoInicial);
  const [planoId, setPlanoId] = useState<string>('');
  const [dataAdesao, setDataAdesao] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [numeroContrato, setNumeroContrato] = useState<string>('CTR-' + Math.random().toString(36).substring(2, 10).toUpperCase());
  const sigCanvas = useRef<HTMLCanvasElement>(null);
  const [assinaturaBase64, setAssinaturaBase64] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const startDrawing = (e: any) => {
    const canvas = sigCanvas.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Configura tamanho real do canvas se ainda não estiver configurado
    if (canvas.width !== canvas.offsetWidth) {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }

    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';

    const pos = getMousePos(canvas, e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsDrawing(true);
  };

  const draw = (e: any) => {
    if (!isDrawing) return;
    const canvas = sigCanvas.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    if (e.cancelable && typeof e.preventDefault === 'function') {
      e.preventDefault(); // Evitar scroll no touch
    }
    const pos = getMousePos(canvas, e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      const canvas = sigCanvas.current;
      if (canvas) {
        setAssinaturaBase64(canvas.toDataURL());
      }
    }
  };

  const getMousePos = (canvas: HTMLCanvasElement, e: any) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches && e.touches.length > 0 ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches && e.touches.length > 0 ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX ?? 0) - rect.left,
      y: (clientY ?? 0) - rect.top
    };
  };
  
  // Permissões
  const isAdminOrSuperAdmin = state.user?.nivel === 'super_admin' || state.user?.nivel === 'admin';

  // Mensalidades
  const [dataInicio, setDataInicio] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [qtdParcelas, setQtdParcelas] = useState<number>(12);
  const [valorExtra, setValorExtra] = useState<number>(0);
  const [valorParcelaManual, setValorParcelaManual] = useState<string>('');
  const [diaVencimento, setDiaVencimento] = useState<number>(10);
  const [parcelas, setParcelas] = useState<any[]>([]);

  useEffect(() => {
    if (!associadoInicial) {
      getAssociados(state.isOnline, state.empresaSelecionada).then(data => {
        setAssociados(data || []);
      }).catch(err => {
        console.error('Erro ao carregar associados no wizard:', err);
      });
    } else {
      setSelectedAssociado(associadoInicial);
      if (associadoInicial.plano_pax_id) {
        setPlanoId(associadoInicial.plano_pax_id);
      }
    }
  }, [associadoInicial, state.isOnline, state.empresaSelecionada]);

  const planoSelecionado = useMemo(() => {
    return (planosCompletos || []).find(p => p.id === planoId);
  }, [planosCompletos, planoId]);

  const ultrapassouLimiteColetivo = useMemo(() => {
    if (!planoSelecionado || !selectedAssociado) return false;
    const nVidas = 1 + (selectedAssociado.dependentes?.length || 0);
    if (planoSelecionado.tipo_plano === 'coletivo') {
      const limite = planoSelecionado.limite_vidas || 999;
      return nVidas > limite;
    }
    return false;
  }, [planoSelecionado, selectedAssociado]);

  const valorPlano = useMemo(() => {
    if (!planoSelecionado || !selectedAssociado) return 0;
    const nVidas = 1 + (selectedAssociado.dependentes?.length || 0);
    const depsIds = (selectedAssociado.dependentes || []).map(d => {
      if (d.data_nascimento) {
        const bdate = new Date(d.data_nascimento);
        return new Date().getFullYear() - bdate.getFullYear();
      }
      return 0;
    });
    return calcularValor(planoSelecionado, nVidas, depsIds, valorExtra).total;
  }, [planoSelecionado, selectedAssociado, calcularValor, valorExtra]);

  const valorBaseParcela = useMemo(() => {
    if (isAdminOrSuperAdmin && valorParcelaManual !== '' && !isNaN(Number(valorParcelaManual)) && Number(valorParcelaManual) >= 0) {
      return Number(valorParcelaManual);
    }
    return valorPlano;
  }, [isAdminOrSuperAdmin, valorParcelaManual, valorPlano]);

  const gerarProjecao = useCallback(() => {
    if (!planoSelecionado) return;
    const dt = new Date(dataInicio + "T12:00:00");
    const arr = [];
    const adesao = planoSelecionado.taxa_adesao || 0;
    const baseParcela = (isAdminOrSuperAdmin && valorParcelaManual !== '' && !isNaN(Number(valorParcelaManual)) && Number(valorParcelaManual) >= 0)
      ? Number(valorParcelaManual)
      : valorPlano;
    
    for (let i = 1; i <= qtdParcelas; i++) {
      const vencimento = new Date(dt.getFullYear(), dt.getMonth() + (i-1), diaVencimento);
      const valorParcela = i === 1 ? (baseParcela + adesao) : baseParcela;
      const descAdesao = i === 1 && adesao > 0 ? " (Inc. Adesão)" : "";
      
      arr.push({
        numero_parcela: i,
        descricao: `Mensalidade ${i}/${qtdParcelas} - ${planoSelecionado.nome}${descAdesao}`,
        data_vencimento: format(vencimento, 'yyyy-MM-dd'),
        valor: valorParcela
      });
    }
    setParcelas(arr);
  }, [planoSelecionado, dataInicio, qtdParcelas, diaVencimento, valorPlano, valorParcelaManual, isAdminOrSuperAdmin]);

  useEffect(() => {
    if (step === 3) gerarProjecao();
  }, [step, gerarProjecao]);

  const handleSave = async () => {
    if (!selectedAssociado || !planoId || parcelas.length === 0) return;
    setLoading(true);
    try {
      const valorFinalPlano = valorBaseParcela;

      // 1. Update Associado
      const associadoAtualizado = {
        ...selectedAssociado,
        plano_pax_id: planoId,
        plano_nome: planoSelecionado?.nome,
        numero_contrato: numeroContrato,
        data_adesao: dataAdesao,
        valor_plano: valorFinalPlano,
        assinatura_base64: assinaturaBase64 || undefined,
        status: 'ativo'
      } as Associado;

      // Historico de contratos se ja tinha um
      if (selectedAssociado.plano_pax_id && selectedAssociado.plano_pax_id !== planoId) {
        const hist = selectedAssociado.historico_contratos ? [...selectedAssociado.historico_contratos] : [];
        hist.push({
            id: uuidv4(),
            plano: selectedAssociado.plano_nome || "Anterior",
            valor: selectedAssociado.valor_plano || 0,
            data_inicio: selectedAssociado.data_adesao || format(new Date(), 'yyyy-MM-dd'),
            data_fim: format(new Date(), 'yyyy-MM-dd')
        });
        associadoAtualizado.historico_contratos = hist;
      }

      await saveAssociado(associadoAtualizado, state.isOnline);

      // 2. Gerar Mensalidades no Financeiro
      const mestreId = uuidv4();
      const totalReceita = parcelas.reduce((acc, p) => acc + p.valor, 0);
      const targetTenant = (selectedAssociado.tenant_id && selectedAssociado.tenant_id !== 'all')
        ? selectedAssociado.tenant_id
        : (state.empresaSelecionada && state.empresaSelecionada !== 'all' ? state.empresaSelecionada : 'default_tenant');
      
      const receitaMestre = {
        id: mestreId,
        tenant_id: targetTenant,
        empresa_id: targetTenant,
        tipo_devedor: 'associado',
        associado_id: associadoAtualizado.id,
        associado_nome: associadoAtualizado.nome,
        associado_cpf: associadoAtualizado.cpf,
        associado_plano: planoSelecionado?.nome,
        descricao: `Contrato de Plano: ${planoSelecionado?.nome} - ${numeroContrato}`,
        categoria: 'Mensalidades',
        data_emissao: format(new Date(), 'yyyy-MM-dd'),
        data_inicio_cobranca: parcelas[0].data_vencimento,
        valor_total: totalReceita,
        qtd_parcelas: qtdParcelas,
        forma_pagamento_padrao: 'boleto',
        status: 'ativo',
        criado_por: state.user?.id || null
      };

      const parcelasGeradas = parcelas.map(p => ({
        id: uuidv4(),
        tenant_id: targetTenant,
        empresa_id: targetTenant,
        receita_id: mestreId,
        numero_parcela: p.numero_parcela,
        total_parcelas: qtdParcelas,
        tipo_devedor: 'associado',
        devedor_nome: associadoAtualizado.nome,
        devedor_cpf_cnpj: associadoAtualizado.cpf || '',
        descricao: p.descricao,
        data_vencimento: p.data_vencimento,
        valor: p.valor,
        forma_pagamento: 'boleto',
        status: 'pendente'
      }));

      await salvarReceita(state.isOnline, receitaMestre as any, parcelasGeradas as any);
      
      await registrarAuditoria('NOVO_CONTRATO_GERADO', { 
        associado_id: associadoAtualizado.id, 
        numero_contrato: numeroContrato,
        receita_mestre_id: mestreId,
        valor: valorFinalPlano,
        manual_override: isAdminOrSuperAdmin && valorParcelaManual !== '' && Number(valorParcelaManual) >= 0
      });

      onSuccess();
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar contrato.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-bg-surface w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border-default">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#3B82F6]/10 text-[#3B82F6] rounded-xl">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-text-base">Cadastro de Novo Contrato</h2>
              <p className="text-sm text-text-subtle">Gere a identificação e configure as mensalidades</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-text-subtle hover:bg-bg-subtle rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Wizard Progress */}
        <div className="flex items-center px-6 py-4 border-b border-border-default bg-bg-subtle/50">
          {[
            { num: 1, label: "Associado" },
            { num: 2, label: "Plano & Contrato" },
            { num: 3, label: "Mensalidades" },
            { num: 4, label: "Assinatura" }
          ].map((s, i) => (
            <React.Fragment key={s.num}>
              <div className={`flex items-center gap-2 ${step === s.num ? 'text-[#3B82F6]' : step > s.num ? 'text-emerald-500' : 'text-text-muted'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                  step === s.num ? 'border-[#3B82F6] bg-[#3B82F6]/10' : 
                  step > s.num ? 'border-emerald-500 bg-emerald-500/10' : 
                  'border-border-default bg-bg-surface'
                }`}>
                  {step > s.num ? <CheckCircle2 className="w-4 h-4" /> : s.num}
                </div>
                <span className="font-semibold text-sm hidden md:inline">{s.label}</span>
              </div>
              {i < 3 && <ChevronRight className="w-4 h-4 text-border-default mx-2" />}
            </React.Fragment>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-text-base">Selecione o Associado</h3>
              {!associadoInicial && (
                <div className="relative">
                  <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" />
                  <input
                    type="text"
                    placeholder="Buscar associado por nome ou CPF..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-bg-subtle border border-border-default rounded-xl text-text-base focus:outline-none focus:border-[#3B82F6]"
                  />
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto">
                {associados
                  .filter(a => a.nome.toLowerCase().includes(searchTerm.toLowerCase()) || a.cpf.includes(searchTerm))
                  .map(a => (
                    <div 
                      key={a.id} 
                      onClick={() => setSelectedAssociado(a)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${selectedAssociado?.id === a.id ? 'border-[#3B82F6] bg-[#3B82F6]/5 ring-2 ring-[#3B82F6]/20' : 'border-border-default bg-bg-surface hover:border-border-hover'}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-bg-subtle rounded-lg">
                          <User className="w-5 h-5 text-text-subtle" />
                        </div>
                        <div>
                          <p className="font-bold text-text-base">{a.nome}</p>
                          <p className="text-xs text-text-muted mt-1">CPF: {a.cpf}</p>
                          {a.plano_pax_id && <span className="inline-flex mt-2 text-[10px] bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded font-bold">Já possui plano</span>}
                        </div>
                      </div>
                    </div>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-text-base">Dados do Contrato</h3>
              
              <div className="bg-[#3B82F6]/5 border border-[#3B82F6]/20 rounded-xl p-4 flex justify-between items-center">
                <div>
                  <p className="text-xs font-semibold text-[#3B82F6] uppercase tracking-wider mb-1">Nº do Contrato Gerado</p>
                  <p className="text-xl font-mono font-bold text-text-base">{numeroContrato}</p>
                </div>
                <button 
                  onClick={() => setNumeroContrato('CTR-' + Math.random().toString(36).substring(2, 10).toUpperCase())}
                  className="text-xs font-semibold text-[#3B82F6] hover:underline"
                >
                  Regerar
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-text-subtle">Plano PAX</label>
                  <select 
                    value={planoId} 
                    onChange={e => setPlanoId(e.target.value)}
                    className="w-full p-3 bg-bg-subtle border border-border-default rounded-xl text-text-base focus:border-[#3B82F6] focus:outline-none"
                  >
                    <option value="">Selecione um plano...</option>
                    {planos.map(p => (
                      <option key={p.id} value={p.id}>{p.nome}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-text-subtle">Data de Adesão</label>
                  <input 
                    type="date"
                    value={dataAdesao}
                    onChange={e => setDataAdesao(e.target.value)}
                    className="w-full p-3 bg-bg-subtle border border-border-default rounded-xl text-text-base focus:border-[#3B82F6] focus:outline-none"
                  />
                </div>
              </div>

              {planoSelecionado && (
                <div className="bg-bg-subtle rounded-xl p-4 space-y-2 border border-border-default">
                  <h4 className="font-bold text-text-base">Resumo Financeiro do Plano</h4>
                  <div className="flex justify-between items-center text-sm border-b border-border-default/50 pb-2">
                    <span className="text-text-subtle">Titular + Dependentes</span>
                    <span className="font-semibold text-text-base">{1 + (selectedAssociado?.dependentes?.length || 0)} Vidas</span>
                  </div>
                  <div className="flex justify-between items-center text-sm border-b border-border-default/50 pb-2 pt-2">
                    <span className="text-text-subtle">Taxa de Adesão</span>
                    <span className="font-semibold text-text-base">R$ {(planoSelecionado.taxa_adesao || 0).toFixed(2).replace('.', ',')}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <span className="font-bold text-text-base">Mensalidade Calculada</span>
                    <span className="font-bold text-[#3B82F6] text-lg">R$ {valorPlano.toFixed(2).replace('.', ',')}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-text-base">Assinatura Digital</h3>
              <p className="text-sm text-text-subtle">Solicite a assinatura do associado para o contrato.</p>
              
              <div className="bg-bg-subtle border border-border-default rounded-xl p-4 flex flex-col items-center">
                <div className="w-full max-w-[600px] border-2 border-dashed border-border-default bg-white rounded-xl overflow-hidden touch-none" style={{ height: '300px' }}>
                  <canvas 
                    ref={sigCanvas as any} 
                    className="w-full h-full"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                  />
                </div>
                <div className="w-full max-w-[600px] mt-4 flex justify-end">
                    <button 
                        type="button"
                        onClick={() => {
                            const canvas = sigCanvas.current;
                            if (canvas) {
                                const ctx = canvas.getContext('2d');
                                ctx?.clearRect(0, 0, canvas.width, canvas.height);
                            }
                            setAssinaturaBase64(null);
                        }}
                        className="px-4 py-2 text-sm text-rose-500 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg transition-colors font-semibold"
                    >
                        Limpar Assinatura
                    </button>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-text-base">Gerar Mensalidades</h3>
              <p className="text-sm text-text-subtle">Programe as cobranças iniciais para o contrato gerado.</p>

              {ultrapassouLimiteColetivo && (
                <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-amber-500 font-medium">
                    <CheckCircle2 className="w-5 h-5 hidden" /> {/* just to import safely, use an alert icon or text */}
                    <span>Atenção: Limite de Vidas Excedido</span>
                  </div>
                  <p className="text-sm text-text-subtle">
                    A quantidade de vidas cadastradas é superior ao máximo permitido ({planoSelecionado?.limite_vidas}) para este plano coletivo. Adicione um valor extra para continuar.
                  </p>
                  <div>
                    <label className="block text-xs font-medium text-text-subtle mb-1">Valor Extra (R$)</label>
                    <input 
                      type="number" 
                      min="0" step="0.01"
                      value={valorExtra || ''}
                      onChange={e => setValorExtra(parseFloat(e.target.value) || 0)}
                      className="w-full max-w-[200px] p-2 bg-bg-surface border border-border-default rounded-lg text-text-base focus:border-[#3B82F6] transition-all"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              )}
              
              <div className={`grid grid-cols-1 ${isAdminOrSuperAdmin ? 'sm:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-3'} gap-4`}>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-text-subtle">Mês de Início</label>
                  <input 
                    type="month" 
                    value={dataInicio.substring(0, 7)} 
                    onChange={e => setDataInicio(e.target.value + "-01")} 
                    className="w-full p-2.5 bg-bg-subtle border border-border-default rounded-lg text-text-base focus:border-[#3B82F6] focus:outline-none" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-text-subtle">Qtd. Parcelas</label>
                  <input 
                    type="number" 
                    min="1" 
                    max="48" 
                    value={qtdParcelas} 
                    onChange={e => setQtdParcelas(Number(e.target.value))} 
                    className="w-full p-2.5 bg-bg-subtle border border-border-default rounded-lg text-text-base focus:border-[#3B82F6] focus:outline-none" 
                  />
                </div>
                {isAdminOrSuperAdmin && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-semibold text-text-subtle flex items-center gap-1.5">
                        <span>Valor Parcela (R$)</span>
                        <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/10 text-amber-500 font-bold rounded border border-amber-500/20">Admin</span>
                      </label>
                      {valorParcelaManual !== '' && (
                        <button
                          type="button"
                          onClick={() => setValorParcelaManual('')}
                          className="text-[11px] text-[#3B82F6] hover:underline"
                          title="Restaurar cálculo automático"
                        >
                          Restaurar auto
                        </button>
                      )}
                    </div>
                    <input 
                      type="number" 
                      min="0" 
                      step="0.01" 
                      placeholder={`Auto (R$ ${valorPlano.toFixed(2).replace('.', ',')})`}
                      value={valorParcelaManual} 
                      onChange={e => setValorParcelaManual(e.target.value)} 
                      className={`w-full p-2.5 bg-bg-subtle border rounded-lg text-text-base focus:outline-none transition-all ${
                        valorParcelaManual !== '' 
                          ? 'border-amber-500 ring-1 ring-amber-500/30' 
                          : 'border-border-default focus:border-[#3B82F6]'
                      }`} 
                    />
                    <span className="text-[11px] text-text-muted block truncate">
                      {valorParcelaManual !== '' 
                        ? 'Valor manual por parcela' 
                        : `Automático: R$ ${valorPlano.toFixed(2).replace('.', ',')}`}
                    </span>
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-text-subtle">Dia do Vencimento</label>
                  <input 
                    type="number" 
                    min="1" 
                    max="31" 
                    value={diaVencimento} 
                    onChange={e => setDiaVencimento(Number(e.target.value))} 
                    className="w-full p-2.5 bg-bg-subtle border border-border-default rounded-lg text-text-base focus:border-[#3B82F6] focus:outline-none" 
                  />
                </div>
              </div>

              <div className="bg-bg-subtle border border-border-default rounded-xl p-4 overflow-hidden">
                <h4 className="font-bold text-text-base mb-3">Prévia das Mensalidades</h4>
                <div className="max-h-[250px] overflow-y-auto space-y-2 pr-2">
                  {parcelas.map((p, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-bg-surface border border-border-default rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#3B82F6]/10 text-[#3B82F6] flex items-center justify-center font-bold text-xs border border-[#3B82F6]/20">
                          {p.numero_parcela}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-text-base">{p.descricao}</p>
                          <p className="text-xs text-text-subtle">Vence em: {p.data_vencimento.split('-').reverse().join('/')}</p>
                        </div>
                      </div>
                      <span className="font-bold text-[#3B82F6]">R$ {p.valor.toFixed(2).replace('.', ',')}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-border-default flex justify-between items-center bg-bg-subtle/30 rounded-b-2xl">
          <button 
            onClick={step === 1 ? onClose : () => setStep(step - 1)}
            className="px-6 py-2.5 rounded-xl font-semibold text-text-subtle hover:text-text-base hover:bg-bg-subtle transition-colors"
          >
            {step === 1 ? 'Cancelar' : 'Voltar'}
          </button>
          
          {step < 4 ? (
            <button
              disabled={
                (step === 1 && !selectedAssociado) || 
                (step === 2 && !planoId)
              }
              onClick={() => {
                if (step === 1 && selectedAssociado?.plano_pax_id) {
                  confirm({
                    title: 'Associado já possui plano',
                    message: 'O associado selecionado já possui um contrato com plano ativo. Por favor, selecione outro associado para dar seguimento.',
                    confirmText: 'Entendi',
                    onConfirm: () => {}
                  });
                  return;
                }
                setStep(step + 1);
              }}
              className="px-6 py-2.5 bg-[#3B82F6] hover:bg-[#3B82F6]/90 text-white rounded-xl font-bold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-[#3B82F6]/20"
            >
              Avançar
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <BotaoSalvar
              type="button"
              onClick={handleSave}
              salvando={loading}
              texto="Confirmar e Gerar Mensalidades"
              textoSalvando="Gerando Contrato e Mensalidades..."
              textoSalvo="Contrato Gerado com Sucesso!"
              variante="primary"
            />
          )}
        </div>
      </div>
    </div>
  );
};
