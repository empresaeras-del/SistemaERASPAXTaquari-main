/**
 * Cadastro e edição dos centros de custo da empresa.
 *
 * Substitui o `OptionsModal` genérico que esta tela usava para centro de custo: aquele
 * gerenciava uma lista de strings no IndexedDB **do navegador** (`useOptions`), então cada
 * operador tinha a sua. Aqui os centros são linhas da empresa, com id, código e estado.
 *
 * Ao contrário do `SeletorContaContabil`, este componente chama `useCentrosCusto` por dentro
 * de propósito: é um gerenciador aberto sob demanda, uma instância por vez, e precisa
 * recarregar a lista depois de cada gravação — passar tudo por props obrigaria a tela que o
 * abre a saber de salvar, desativar e reativar, que não é assunto dela.
 *
 * O código não é digitável: vem do nome (`codigoDeCentroCusto`, puro e testado) e nunca muda
 * depois de criado — é por ele que quem exportou relatório reconhece o centro. Mesma decisão
 * de "codificação imposta" das contas contábeis.
 */
import React, { useMemo, useState } from 'react';
import { X, Plus, Pencil, Power, PowerOff, Check, Building2, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCentrosCusto } from '../../hooks/useCentrosCusto';
import { CentroCusto } from '../../types/centroCusto';
import { codigoDeCentroCusto } from '../../utils/centrosCusto';

interface CentrosCustoModalProps {
  onClose: () => void;
  /** Falso deixa a lista só de leitura — mesma checagem de permissão da tela que abre. */
  podeEditar?: boolean;
}

interface FormState {
  id: string | null;
  nome: string;
  descricao: string;
}

export const CentrosCustoModal: React.FC<CentrosCustoModalProps> = ({ onClose, podeEditar = true }) => {
  const { centros, loading, error, salvar, desativar, reativar } = useCentrosCusto();

  const [form, setForm] = useState<FormState | null>(null);
  const [salvando, setSalvando] = useState(false);

  const nomeJaExiste = useMemo(() => {
    if (!form) return false;
    const alvo = form.nome.trim().toLowerCase();
    if (!alvo) return false;
    return centros.some((c) => c.id !== form.id && c.nome.trim().toLowerCase() === alvo);
  }, [form, centros]);

  const abrirNovo = () => setForm({ id: null, nome: '', descricao: '' });
  const abrirEdicao = (c: CentroCusto) =>
    setForm({ id: c.id, nome: c.nome, descricao: c.descricao || '' });

  const handleSalvar = async () => {
    if (!form) return;
    const nome = form.nome.trim();
    if (!nome) {
      toast.error('Informe o nome do centro de custo.');
      return;
    }
    if (nomeJaExiste) {
      toast.error('Já existe um centro de custo com esse nome nesta empresa.');
      return;
    }

    setSalvando(true);
    try {
      await salvar({ id: form.id || undefined, nome, descricao: form.descricao.trim() || null });
      toast.success(form.id ? 'Centro de custo atualizado.' : 'Centro de custo cadastrado.');
      setForm(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível salvar o centro de custo.');
    } finally {
      setSalvando(false);
    }
  };

  const alternarAtivo = async (c: CentroCusto) => {
    try {
      if (c.ativo) {
        await desativar(c);
        toast.success(`${c.nome} desativado. As despesas que já o usam continuam intactas.`);
      } else {
        await reativar(c);
        toast.success(`${c.nome} reativado.`);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível alterar o centro de custo.');
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl bg-bg-surface border border-border-default rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-default shrink-0">
          <h2 className="text-base font-bold text-text-base flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#3B82F6]" />
            Centros de Custo
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-bg-base text-text-subtle transition-colors"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-4 overflow-y-auto space-y-4">
          <p className="text-xs text-text-subtle">
            Os centros de custo são desta empresa e valem para todos os operadores dela. Desativar um
            centro tira ele do seletor de novas despesas, mas <b>não</b> altera as despesas que já o
            usam — por isso não existe excluir.
          </p>

          {error && (
            <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-sm">
              {error}
            </div>
          )}

          {loading && <p className="text-sm text-text-subtle">Carregando centros de custo…</p>}

          {!loading && centros.length === 0 && !form && (
            <div className="p-4 rounded-xl border border-border-default bg-bg-base text-sm text-text-subtle flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
              <span>
                Esta empresa ainda não tem nenhum centro de custo cadastrado. Enquanto não houver,
                o formulário de despesa continua usando a lista antiga de opções.
              </span>
            </div>
          )}

          {!loading && centros.length > 0 && (
            <ul className="divide-y divide-border-default border border-border-default rounded-xl overflow-hidden">
              {centros.map((c) => (
                <li
                  key={c.id}
                  className={`flex items-center gap-3 px-4 py-2.5 bg-bg-base ${c.ativo ? '' : 'opacity-60'}`}
                >
                  <span className="font-mono text-xs text-text-muted w-44 shrink-0 truncate" title={c.codigo}>
                    {c.codigo}
                  </span>
                  <span className="flex-1 text-sm text-text-base truncate" title={c.descricao || c.nome}>
                    {c.nome}
                    {!c.ativo && <span className="ml-2 text-xs text-text-muted">(desativado)</span>}
                  </span>
                  {podeEditar && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => abrirEdicao(c)}
                        className="p-1.5 rounded-lg hover:bg-bg-surface text-text-subtle transition-colors"
                        title="Editar"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => alternarAtivo(c)}
                        className="p-1.5 rounded-lg hover:bg-bg-surface text-text-subtle transition-colors"
                        title={c.ativo ? 'Desativar' : 'Reativar'}
                      >
                        {c.ativo ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {form && (
            <div className="p-4 rounded-xl border border-[#3B82F6]/40 bg-[#3B82F6]/5 space-y-3">
              <h3 className="text-sm font-bold text-text-base">
                {form.id ? 'Editar centro de custo' : 'Novo centro de custo'}
              </h3>

              <div>
                <label className="block text-xs font-medium text-text-subtle mb-1">Nome *</label>
                <input
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Rede Assistencial"
                  autoFocus
                  className={`w-full bg-bg-base border rounded-xl px-3 py-2 text-sm text-text-base outline-none ${
                    nomeJaExiste ? 'border-rose-500' : 'border-border-default focus:border-[#3B82F6]'
                  }`}
                />
                {nomeJaExiste && (
                  <p className="text-rose-400 text-xs mt-1">
                    Já existe um centro de custo com esse nome nesta empresa.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-text-subtle mb-1">
                  Código <span className="text-text-muted">(automático)</span>
                </label>
                {/*
                  O código vem do nome e não é digitável — e, num centro que já existe, não muda
                  nem quando o nome muda: é por ele que quem exportou relatório reconhece o centro.
                */}
                <input
                  value={
                    form.id
                      ? centros.find((c) => c.id === form.id)?.codigo || ''
                      : codigoDeCentroCusto(form.nome)
                  }
                  readOnly
                  aria-readonly="true"
                  title={
                    form.id
                      ? 'O código de um centro existente não muda.'
                      : 'Gerado a partir do nome.'
                  }
                  className="w-full bg-bg-surface/60 border border-border-default rounded-xl px-3 py-2 text-sm font-mono text-text-muted outline-none cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-subtle mb-1">
                  Descrição <span className="text-text-muted">(opcional)</span>
                </label>
                <input
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  className="w-full bg-bg-base border border-border-default rounded-xl px-3 py-2 text-sm text-text-base focus:border-[#3B82F6] outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSalvar}
                  disabled={salvando || nomeJaExiste}
                  className="px-3 py-1.5 rounded-lg bg-[#3B82F6] hover:bg-blue-600 disabled:opacity-60 text-white text-sm font-bold flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  {salvando ? 'Salvando…' : 'Salvar'}
                </button>
                <button
                  type="button"
                  onClick={() => setForm(null)}
                  className="px-3 py-1.5 rounded-lg border border-border-default text-text-subtle hover:bg-bg-base text-sm"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-border-default shrink-0">
          {podeEditar && !form ? (
            <button
              type="button"
              onClick={abrirNovo}
              className="px-3 py-2 rounded-xl bg-[#3B82F6] hover:bg-blue-600 text-white text-sm font-bold flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Novo Centro de Custo
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-border-default text-text-subtle hover:bg-bg-base text-sm"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
