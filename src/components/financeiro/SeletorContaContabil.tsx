/**
 * Seleção da conta contábil de um lançamento — um componente só para as duas telas
 * (Contas a Receber e Contas a Pagar), justamente para elas não divergirem como divergiram
 * as duas listas de `useOptions` que este módulo substitui.
 *
 * Recebe as contas por props em vez de chamar `usePlanoContabil` por dentro: a tela que o
 * usa já precisa do hook (para saber se a empresa tem plano montado), e um hook aqui dentro
 * significaria carregar plano e contas duas vezes a cada abertura do formulário. De quebra,
 * o componente fica orientado a props — o formato mais barato de testar neste projeto.
 *
 * As opções vêm agrupadas pela conta sintética (`<optgroup>`), que é o que dá ao seletor a
 * leitura de plano de contas em vez de uma lista chapada.
 */
import React, { useMemo } from 'react';
import { BookOpen, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ContaContabil, NaturezaContabil } from '../../types/planoContabil';
import { agruparContasPorPai } from '../../utils/planoContabilTree';

interface SeletorContaContabilProps {
  natureza: NaturezaContabil;
  /** Contas analíticas e ativas da natureza — já filtradas por `contasLancaveis`. */
  lancaveis: ContaContabil[];
  /** Todas as contas do plano, para resolver o nome do grupo e a conta já gravada. */
  contas: ContaContabil[];
  /** Id da conta selecionada, ou `''` quando o lançamento ainda não está classificado. */
  value: string;
  /** Recebe o id e o nome da conta — o nome vira o rótulo (`categoria`) do lançamento. */
  onChange: (contaId: string, contaNome: string) => void;
  erro?: string;
  loading?: boolean;
  temPlano?: boolean;
}

export const SeletorContaContabil: React.FC<SeletorContaContabilProps> = ({
  natureza,
  lancaveis,
  contas,
  value,
  onChange,
  erro,
  loading = false,
  temPlano = true,
}) => {
  const { grupos, semGrupo } = useMemo(
    () => agruparContasPorPai(lancaveis, contas),
    [lancaveis, contas],
  );

  // Conta já gravada que não está mais entre as lançáveis (foi desativada depois do
  // lançamento): precisa continuar aparecendo, senão abrir o lançamento para editar
  // apagaria a classificação dele. É o mesmo motivo pelo qual o trigger do banco não
  // valida `ativo` — ver a migration da fase 2.
  const selecionadaForaDaLista = useMemo(() => {
    if (!value || lancaveis.some((c) => c.id === value)) return null;
    return contas.find((c) => c.id === value) || null;
  }, [value, lancaveis, contas]);

  const handleChange = (id: string) => {
    if (!id) {
      onChange('', '');
      return;
    }
    onChange(id, contas.find((c) => c.id === id)?.nome || '');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-sm font-medium text-text-subtle">Conta Contábil *</label>
        <Link
          to="/financeiro/plano-contabil"
          className="text-[#3B82F6] hover:bg-[#3B82F6]/10 px-1.5 py-0.5 rounded-md transition-colors flex items-center gap-1 text-xs"
          title="Abrir o plano de contas"
        >
          <BookOpen className="w-3.5 h-3.5" />
          Plano de contas
        </Link>
      </div>

      <select
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        disabled={loading}
        className={`w-full bg-bg-surface border rounded-xl px-4 py-2.5 text-text-base outline-none disabled:opacity-60 ${
          erro ? 'border-rose-500' : 'border-border-default focus:border-[#3B82F6]'
        }`}
      >
        <option value="">
          {loading ? 'Carregando plano de contas…' : 'Selecione a conta contábil...'}
        </option>

        {selecionadaForaDaLista && (
          <option value={selecionadaForaDaLista.id}>
            {selecionadaForaDaLista.codigo} — {selecionadaForaDaLista.nome} (desativada)
          </option>
        )}

        {semGrupo.map((c) => (
          <option key={c.id} value={c.id}>
            {c.codigo} — {c.nome}
          </option>
        ))}

        {grupos.map((g) => (
          <optgroup key={g.titulo} label={g.titulo}>
            {g.contas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.codigo} — {c.nome}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      {erro && <p className="text-rose-500 text-xs mt-1">{erro}</p>}

      {!loading && !temPlano && (
        <p className="text-amber-400 text-xs mt-1 flex items-start gap-1">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            Esta empresa ainda não tem plano de contas.{' '}
            <Link to="/financeiro/plano-contabil" className="underline">
              Criar agora
            </Link>
            .
          </span>
        </p>
      )}

      {!loading && temPlano && lancaveis.length === 0 && (
        <p className="text-amber-400 text-xs mt-1">
          O plano de contas não tem nenhuma conta analítica de {natureza} ativa.
        </p>
      )}
    </div>
  );
};
