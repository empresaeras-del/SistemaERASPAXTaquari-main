import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, RefreshCw, Users } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Associado, getAssociados } from '../../services/associadosService';
import { ParcelaReceber, Receita, getParcelasReceber, getReceitas } from '../../services/financeiroService';
import {
  CarteiraEmpresaConveniada,
  MESES_ABREVIADOS,
  montarCarteiraEmpresaConveniada,
} from '../../utils/carteiraEmpresaConveniada';
import { formatCurrency } from '../../utils/formatters';
import { formatDateSafe } from '../../utils/dateUtils';
import { maskCPFOrCNPJ } from '../../utils/validators';

interface Props {
  /** Id do fornecedor já GRAVADO. Sem id não há vínculo possível. */
  fornecedorId?: string;
  /**
   * Empresa do próprio fornecedor. É ela que escopa a consulta, não o seletor do topo: o
   * seletor pode estar em `'all'`, e `getParcelasReceber` trata `'all'` como "sem filtro" —
   * a carteira passaria a somar parcela de outra empresa. Ver CLAUDE.md, "Ao passar um tenant
   * para uma função de leitura, saiba se ela trata `'all'` como sem filtro".
   */
  tenantId?: string;
  /** Nome da conveniada, só para o texto do estado vazio. */
  nomeEmpresa?: string;
}

const hojeAno = () => new Date().getFullYear();

export const FornecedorAssociadosTab: React.FC<Props> = ({ fornecedorId, tenantId, nomeEmpresa }) => {
  const { state } = useAppContext();
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [associados, setAssociados] = useState<Associado[]>([]);
  const [parcelas, setParcelas] = useState<ParcelaReceber[]>([]);
  const [receitas, setReceitas] = useState<Receita[]>([]);
  const [exercicio, setExercicio] = useState<number>(hojeAno());

  const carregar = useCallback(async () => {
    if (!fornecedorId || !tenantId) {
      setCarregando(false);
      return;
    }
    setCarregando(true);
    setErro(null);
    try {
      const [assocs, parcs, recs] = await Promise.all([
        getAssociados(state.isOnline, tenantId),
        getParcelasReceber(state.isOnline, tenantId),
        getReceitas(state.isOnline, tenantId),
      ]);
      setAssociados(assocs || []);
      setParcelas(parcs || []);
      setReceitas(recs || []);
    } catch (e: any) {
      // A recusa chega inteira à tela: um "erro ao carregar" genérico não diz se o problema é
      // permissão, rede ou dado — e esta aba existe para ser conferida contra o banco.
      setErro(e?.message || 'Não foi possível carregar a carteira desta empresa conveniada.');
    } finally {
      setCarregando(false);
    }
  }, [fornecedorId, tenantId, state.isOnline]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const carteira: CarteiraEmpresaConveniada = useMemo(
    () => montarCarteiraEmpresaConveniada({ associados, parcelas, receitas, fornecedorId, exercicio }),
    [associados, parcelas, receitas, fornecedorId, exercicio]
  );

  // O ano corrente entra na lista mesmo sem lançamento nenhum: é o exercício que o operador
  // espera encontrar aberto quando abre a aba.
  const anos = useMemo(() => {
    const conjunto = new Set<number>([...carteira.exerciciosDisponiveis, exercicio, hojeAno()]);
    return Array.from(conjunto).sort((a, b) => b - a);
  }, [carteira.exerciciosDisponiveis, exercicio]);

  if (!fornecedorId || !tenantId) {
    return (
      <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-sm text-amber-600 dark:text-amber-400">
          Salve o cadastro desta empresa antes de vincular associados a ela. A carteira aparece aqui
          depois que o fornecedor existir no banco.
        </div>
      </div>
    );
  }

  if (carregando) {
    return (
      <div className="p-6 flex-1 flex items-center justify-center text-text-subtle gap-2 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        Carregando a carteira desta empresa…
      </div>
    );
  }

  if (erro) {
    return (
      <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 text-sm text-rose-600 dark:text-rose-400 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold mb-1">A carteira não pôde ser carregada.</p>
            <p className="text-xs opacity-90">{erro}</p>
          </div>
          <button
            type="button"
            onClick={carregar}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-bg-surface border border-border-default text-xs font-semibold text-text-base hover:bg-bg-hover flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Tentar de novo
          </button>
        </div>
      </div>
    );
  }

  if (carteira.linhas.length === 0) {
    return (
      <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
        <div className="bg-bg-surface border border-border-default rounded-xl p-8 text-center">
          <Users className="w-8 h-8 mx-auto text-text-subtle mb-3" />
          <p className="text-sm font-semibold text-text-base mb-1">
            Nenhum associado vinculado a {nomeEmpresa || 'esta empresa'}.
          </p>
          <p className="text-xs text-text-subtle max-w-md mx-auto">
            O vínculo é feito no cadastro do associado: em <strong>Associados → Contratos</strong>,
            escolha <strong>Pessoa Jurídica (PJ)</strong> e selecione esta empresa no campo
            <strong> Empresa / Convênio</strong>.
          </p>
        </div>
      </div>
    );
  }

  const temNota = carteira.canceladas.quantidade > 0 || carteira.foraDoExercicio.quantidade > 0;

  return (
    <div className="p-6 flex-1 overflow-y-auto space-y-5 custom-scrollbar">
      {/* Cabeçalho: exercício e os dois números que resumem a carteira */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <label className="block text-[11px] font-bold text-text-subtle uppercase tracking-wider mb-1">
            Exercício
          </label>
          <select
            value={exercicio}
            onChange={(e) => setExercicio(Number(e.target.value))}
            className="bg-bg-base border border-border-default rounded-xl px-4 py-2 text-sm text-text-base focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent outline-none"
          >
            {anos.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-3">
          <div className="px-4 py-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 min-w-[150px]">
            <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase">
              Recebido em {exercicio}
            </div>
            <div className="text-lg font-black text-emerald-700 dark:text-emerald-400 tabular-nums">
              {formatCurrency(carteira.totalRecebido)}
            </div>
          </div>
          <div className="px-4 py-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 min-w-[150px]">
            <div className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase">
              Em aberto em {exercicio}
            </div>
            <div className="text-lg font-black text-amber-700 dark:text-amber-400 tabular-nums">
              {formatCurrency(carteira.totalEmAberto)}
            </div>
          </div>
          <div className="px-4 py-2.5 rounded-xl border border-border-default bg-bg-surface min-w-[110px]">
            <div className="text-[10px] font-bold text-text-subtle uppercase">Associados</div>
            <div className="text-lg font-black text-text-base tabular-nums">{carteira.linhas.length}</div>
          </div>
        </div>
      </div>

      {/* A tabela é larga por construção (12 meses) e rola no próprio container. */}
      <div className="border border-border-default rounded-xl overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-bg-surface border-b border-border-default">
              <th className="px-4 py-3 text-xs font-semibold text-text-subtle uppercase tracking-wider sticky left-0 bg-bg-surface min-w-[240px]">
                Associado
              </th>
              {MESES_ABREVIADOS.map((m) => (
                <th
                  key={m}
                  className="px-2 py-3 text-center text-xs font-semibold text-text-subtle uppercase tracking-wider min-w-[78px]"
                >
                  {m}
                </th>
              ))}
              <th className="px-4 py-3 text-right text-xs font-semibold text-text-subtle uppercase tracking-wider min-w-[120px] sticky right-0 bg-bg-surface">
                Total
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-default">
            {carteira.linhas.map((linha) => (
              <tr key={linha.associado.id} className="hover:bg-bg-surface/50 transition-colors">
                <td className="px-4 py-3 sticky left-0 bg-bg-subtle">
                  <div className="font-semibold text-text-base">{linha.associado.nome}</div>
                  <div className="text-[11px] text-text-subtle flex flex-wrap gap-x-2">
                    {linha.associado.cpf && <span>{maskCPFOrCNPJ(linha.associado.cpf)}</span>}
                    {linha.qtdEmAberto > 0 && linha.vencimentoMaisAntigoEmAberto && (
                      <span className="text-amber-600 dark:text-amber-400">
                        {linha.qtdEmAberto} em aberto desde {formatDateSafe(linha.vencimentoMaisAntigoEmAberto)}
                      </span>
                    )}
                  </div>
                </td>

                {linha.meses.map((celula, i) => (
                  <td key={i} className="px-2 py-3 text-center align-top tabular-nums">
                    {celula.qtdRecebida === 0 && celula.qtdEmAberto === 0 ? (
                      <span className="text-text-subtle/40">—</span>
                    ) : (
                      <div className="space-y-0.5">
                        {celula.recebido > 0 && (
                          <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(celula.recebido)}
                          </div>
                        )}
                        {celula.emAberto > 0 && (
                          <div className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                            {formatCurrency(celula.emAberto)}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                ))}

                <td className="px-4 py-3 text-right align-top tabular-nums sticky right-0 bg-bg-subtle">
                  {linha.totalRecebido === 0 && linha.totalEmAberto === 0 ? (
                    <span className="text-text-subtle/40">—</span>
                  ) : (
                    <>
                      {linha.totalRecebido > 0 && (
                        <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(linha.totalRecebido)}
                        </div>
                      )}
                      {linha.totalEmAberto > 0 && (
                        <div className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                          {formatCurrency(linha.totalEmAberto)}
                        </div>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-bg-surface border-t-2 border-border-default">
              <td className="px-4 py-3 font-bold text-text-base sticky left-0 bg-bg-surface">Total</td>
              {carteira.totaisPorMes.map((celula, i) => (
                <td key={i} className="px-2 py-3 text-center tabular-nums">
                  {celula.recebido === 0 && celula.emAberto === 0 ? (
                    <span className="text-text-subtle/40">—</span>
                  ) : (
                    <div className="space-y-0.5">
                      {celula.recebido > 0 && (
                        <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(celula.recebido)}
                        </div>
                      )}
                      {celula.emAberto > 0 && (
                        <div className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                          {formatCurrency(celula.emAberto)}
                        </div>
                      )}
                    </div>
                  )}
                </td>
              ))}
              <td className="px-4 py-3 text-right tabular-nums sticky right-0 bg-bg-surface">
                {carteira.totalRecebido > 0 && (
                  <div className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(carteira.totalRecebido)}
                  </div>
                )}
                {carteira.totalEmAberto > 0 && (
                  <div className="text-xs font-black text-amber-600 dark:text-amber-400">
                    {formatCurrency(carteira.totalEmAberto)}
                  </div>
                )}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-[11px] text-text-subtle">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Recebido
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Em aberto
        </span>
        <span>A mensalidade aparece no mês em que <strong>vence</strong>, mesmo se paga depois.</span>
      </div>

      {/* O que não entra na soma aparece como nota, em vez de sumir — mesma regra da
          Demonstração Contábil e do mapa de calor de Contas a Receber. */}
      {temNota && (
        <div className="bg-bg-surface border border-border-default rounded-xl p-4 space-y-1.5 text-xs text-text-subtle">
          <p className="font-semibold text-text-base text-[11px] uppercase tracking-wider">
            Fora dos totais acima
          </p>
          {carteira.foraDoExercicio.quantidade > 0 && (
            <p>
              <strong>{carteira.foraDoExercicio.quantidade}</strong> parcela(s) de outros exercícios,
              somando <strong>{formatCurrency(carteira.foraDoExercicio.valor)}</strong> — troque o
              exercício acima para vê-las.
            </p>
          )}
          {carteira.canceladas.quantidade > 0 && (
            <p>
              <strong>{carteira.canceladas.quantidade}</strong> parcela(s) canceladas em {exercicio},
              somando <strong>{formatCurrency(carteira.canceladas.valor)}</strong> — elas existem no
              banco e não cobram ninguém.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
