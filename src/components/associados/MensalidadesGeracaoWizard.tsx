import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import { AlertCircle } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { salvarReceita } from '../../services/financeiroService';
import { RegrasCalculoInfo } from './RegrasCalculoInfo';
import { useSeletorPlanoPax } from '../../hooks/useSeletorPlanoPax';
import { formatLocalDate } from '../../utils/dateUtils';
import { registrarAuditoria } from '../../lib/supabase';
import { formatCurrency } from '../../utils/formatters';
import {
  ultrapassaLimiteColetivo,
  calcularValorMensalidadeBase,
  descricaoCalculoMensalidade,
  gerarProjecaoParcelas,
} from '../../utils/mensalidadesAssociadoHelpers';

export const MensalidadesGeracaoWizard = ({
  associado,
  onSuccess,
  onCancel,
  defaultDataInicio
}: {
  associado: any;
  onSuccess: () => void;
  onCancel: () => void;
  defaultDataInicio?: string;
}) => {
  const toast = useToast();
  const { state } = useAppContext();
  const isAdminOrSuperAdmin = state.user?.nivel === 'super_admin' || state.user?.nivel === 'admin';
  const { selecionarPlano, planoSelecionado } = useSeletorPlanoPax();
  const [dataInicio, setDataInicio] = useState<string>(defaultDataInicio || format(new Date(), 'yyyy-MM-dd'));
  const [qtdParcelas, setQtdParcelas] = useState<number>(12);
  const [diaVencimento, setDiaVencimento] = useState<number>(10);
  const [loading, setLoading] = useState(false);
  const [parcelas, setParcelas] = useState<any[]>([]);
  const [valorExtra, setValorExtra] = useState<number>(0);
  const [valorParcelaManual, setValorParcelaManual] = useState<string>('');

  useEffect(() => {
    if (associado.plano_pax_id) {
      selecionarPlano(associado.plano_pax_id);
    }
  }, [associado.plano_pax_id, selecionarPlano]);

  const vidasCadastradas = associado.n_vidas || 1;

  const ultrapassouLimiteColetivo = useMemo(
    () => ultrapassaLimiteColetivo(planoSelecionado, vidasCadastradas),
    [planoSelecionado, vidasCadastradas]
  );

  const valorMensalidadeBase = useMemo(
    () => calcularValorMensalidadeBase(planoSelecionado, vidasCadastradas, valorExtra),
    [planoSelecionado, vidasCadastradas, valorExtra]
  );

  const descricaoCalculo = useMemo(
    () => descricaoCalculoMensalidade(planoSelecionado, vidasCadastradas, valorExtra),
    [planoSelecionado, vidasCadastradas, valorExtra]
  );

  const gerarProjecao = useCallback(() => {
    if (!planoSelecionado) return;

    const adesao = planoSelecionado.taxa_adesao || 0;
    const baseParcela = (isAdminOrSuperAdmin && valorParcelaManual !== '' && !isNaN(Number(valorParcelaManual)) && Number(valorParcelaManual) >= 0)
      ? Number(valorParcelaManual)
      : valorMensalidadeBase;

    setParcelas(gerarProjecaoParcelas({
      dataInicioISO: dataInicio,
      qtdParcelas,
      diaVencimento,
      baseParcela,
      taxaAdesao: adesao,
      planoNome: planoSelecionado.nome,
      formatarData: (d: Date | number) => format(d, 'yyyy-MM-dd'),
    }));
  }, [planoSelecionado, dataInicio, qtdParcelas, diaVencimento, valorMensalidadeBase, valorParcelaManual, isAdminOrSuperAdmin]);

  useEffect(() => {
    gerarProjecao();
  }, [gerarProjecao]);

  const confirmarGeracao = async () => {
    if (parcelas.length === 0) return;
    setLoading(true);
    try {
      const mestreId = uuidv4();
      const totalReceita = parcelas.reduce((acc, p) => acc + p.valor, 0);
      const targetTenant = (associado.tenant_id && associado.tenant_id !== 'all')
        ? associado.tenant_id
        : (state.empresaSelecionada && state.empresaSelecionada !== 'all' ? state.empresaSelecionada : 'default_tenant');

      const receitaMestre = {
        id: mestreId,
        tenant_id: targetTenant,
        empresa_id: targetTenant,
        tipo_devedor: 'associado',
        associado_id: associado.id,
        associado_nome: associado.nome,
        associado_cpf: associado.cpf,
        associado_plano: planoSelecionado?.nome,
        descricao: `Contrato de Plano: ${planoSelecionado?.nome}`,
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
        devedor_nome: associado.nome,
        devedor_cpf_cnpj: associado.cpf || '',
        descricao: p.descricao,
        data_vencimento: p.data_vencimento,
        valor: p.valor,
        forma_pagamento: 'boleto',
        status: 'pendente'
      }));

      await salvarReceita(state.isOnline, receitaMestre as any, parcelasGeradas as any);

      await registrarAuditoria('MENSALIDADES_GERADAS', {
        receita_mestre_id: mestreId,
        associado_id: associado.id,
        qtd_parcelas: parcelasGeradas.length,
        valor_total: totalReceita,
        online: state.isOnline
      });

      toast.success("Mensalidades geradas com sucesso no Financeiro!");
      onSuccess();
    } catch (e: any) {
      console.error(e);
      await registrarAuditoria('FALHA_GERACAO_MENSALIDADES', {
        associado_id: associado.id,
        plano_id: planoSelecionado?.id,
        erro: e.message || String(e),
        online: state.isOnline
      });
      toast.error("Erro ao gerar mensalidades no financeiro");
    } finally {
      setLoading(false);
    }
  };

  if (!associado.plano_pax_id) {
    return (
      <div className="p-8 text-center text-text-subtle bg-bg-surface rounded-2xl border border-dashed border-border-default space-y-3">
        <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
        <p className="font-medium text-text-base">Nenhum plano selecionado</p>
        <p className="text-xs">Selecione um plano na aba &quot;Contratos&quot; antes de gerar mensalidades para este associado.</p>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-bg-subtle border border-border-default rounded-xl text-xs font-semibold hover:bg-bg-hover"
        >
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-border-default pb-4">
        <div>
          <h4 className="text-text-base font-bold text-lg">Geração de Mensalidades</h4>
          <p className="text-xs text-text-subtle">Configure a periodicidade e valores das parcelas a serem geradas.</p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 bg-bg-subtle border border-border-default text-text-subtle hover:text-text-base rounded-xl text-xs font-semibold"
        >
          Voltar ao Organograma
        </button>
      </div>

      <div className="flex flex-col xl:flex-row gap-6 items-start">
        <div className="flex-1 space-y-6 w-full">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-bg-surface p-4 rounded-2xl border border-border-default">
            <div>
              <p className="text-xs text-text-subtle mb-1">Plano Selecionado</p>
              <p className="text-sm text-text-base font-bold">{planoSelecionado?.nome || 'Carregando...'}</p>
            </div>
            <div>
              <p className="text-xs text-text-subtle mb-1">Taxa de Adesão</p>
              <p className="text-sm text-text-base font-bold">
                {formatCurrency(planoSelecionado?.taxa_adesao || 0)}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-subtle mb-1">Total de Vidas</p>
              <p className="text-sm text-text-base font-bold">{associado.n_vidas || 1}</p>
            </div>
            <div>
              <p className="text-xs text-text-subtle mb-1">Valor Calculado p/ Mensalidade</p>
              <p className="text-sm text-emerald-400 font-extrabold font-mono">
                {formatCurrency(valorMensalidadeBase)}
              </p>
              <p className="text-[10px] text-text-subtle mt-0.5">{descricaoCalculo}</p>
            </div>
          </div>

          {ultrapassouLimiteColetivo && (
            <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex flex-col gap-2">
              <div className="flex items-center gap-2 text-amber-500 font-bold text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Atenção: Limite de Vidas Excedido</span>
              </div>
              <p className="text-xs text-text-subtle">
                A quantidade de vidas cadastradas ({vidasCadastradas}) é superior ao máximo permitido ({planoSelecionado?.limite_vidas}) para este plano coletivo.
              </p>
              <div>
                <label className="block text-xs font-medium text-text-subtle mb-1">Valor Extra a Cobrar (R$)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={valorExtra || ''}
                  onChange={e => setValorExtra(parseFloat(e.target.value) || 0)}
                  className="w-full max-w-[200px] bg-bg-surface border border-border-default rounded-xl px-4 py-2 text-text-base focus:border-[#3B82F6] transition-all text-sm font-bold"
                  placeholder="0.00"
                />
              </div>
            </div>
          )}

          <div className={`grid grid-cols-1 ${isAdminOrSuperAdmin ? 'sm:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-3'} gap-4`}>
            <div>
              <label className="block text-xs font-medium text-text-subtle mb-1">Data Base / Início</label>
              <input
                required
                type="date"
                value={dataInicio}
                onChange={e => setDataInicio(e.target.value)}
                className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2 text-text-base text-sm focus:border-[#3B82F6] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-subtle mb-1">Qtd Parcelas (Meses)</label>
              <input
                type="number"
                min="1"
                max="120"
                value={qtdParcelas}
                onChange={e => setQtdParcelas(parseInt(e.target.value) || 1)}
                className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2 text-text-base text-sm focus:border-[#3B82F6] outline-none"
              />
            </div>
            {isAdminOrSuperAdmin && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-text-subtle flex items-center gap-1.5">
                    <span>Valor Parcela (R$)</span>
                    <span className="text-[10px] px-1.5 py-0.2 bg-amber-500/10 text-amber-500 font-bold rounded border border-amber-500/20">Admin</span>
                  </label>
                  {valorParcelaManual !== '' && (
                    <button
                      type="button"
                      onClick={() => setValorParcelaManual('')}
                      className="text-[10px] text-[#3B82F6] hover:underline"
                      title="Restaurar cálculo automático"
                    >
                      Restaurar
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder={`Auto (R$ ${valorMensalidadeBase.toFixed(2).replace('.', ',')})`}
                  value={valorParcelaManual}
                  onChange={e => setValorParcelaManual(e.target.value)}
                  className={`w-full bg-bg-surface border rounded-xl px-4 py-2 text-text-base text-sm outline-none transition-all ${
                    valorParcelaManual !== '' 
                      ? 'border-amber-500 ring-1 ring-amber-500/30' 
                      : 'border-border-default focus:border-[#3B82F6]'
                  }`}
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-text-subtle mb-1">Dia de Vencimento</label>
              <input
                type="number"
                min="1"
                max="31"
                value={diaVencimento}
                onChange={e => setDiaVencimento(parseInt(e.target.value) || 1)}
                className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2 text-text-base text-sm focus:border-[#3B82F6] outline-none"
              />
            </div>
          </div>

          {parcelas.length > 0 && (
            <div className="space-y-4">
              <h5 className="text-xs font-bold text-text-base uppercase tracking-wider border-b border-border-default pb-2">
                Prévia das Parcelas Calculadas ({parcelas.length})
              </h5>
              <div className="max-h-[260px] overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                {parcelas.map((p, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-bg-surface border border-border-default rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-bg-subtle flex items-center justify-center text-xs font-bold text-text-subtle">
                        {p.numero_parcela}
                      </div>
                      <div>
                        <p className="text-xs text-text-base font-semibold">{p.descricao}</p>
                        <p className="text-[10px] text-text-subtle">Vence em: {formatLocalDate(p.data_vencimento)}</p>
                      </div>
                    </div>
                    <div className="text-emerald-400 font-bold flex items-center gap-1 text-xs">
                      R$
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-24 bg-bg-subtle border border-border-default rounded px-2 py-1 text-right focus:border-[#3B82F6] text-text-base font-bold text-xs"
                        value={p.valor || ''}
                        onChange={(e) => {
                          const newVal = parseFloat(e.target.value) || 0;
                          const newParcelas = [...parcelas];
                          newParcelas[idx].valor = newVal;
                          setParcelas(newParcelas);
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-border-default">
                <div className="text-xs text-text-subtle">
                  Total a gerar: <strong className="text-sm font-bold text-emerald-400">{formatCurrency(parcelas.reduce((acc, p) => acc + p.valor, 0))}</strong>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={onCancel}
                    disabled={loading}
                    className="px-4 py-2 bg-bg-subtle border border-border-default text-text-base hover:bg-bg-hover text-xs font-semibold rounded-xl transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={confirmarGeracao}
                    disabled={loading || (ultrapassouLimiteColetivo && (!valorExtra || valorExtra <= 0))}
                    className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/25"
                  >
                    {loading ? 'Gerando...' : 'Confirmar e Lançar'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="w-full xl:w-[320px] shrink-0">
          <RegrasCalculoInfo />
        </div>
      </div>
    </div>
  );
};
