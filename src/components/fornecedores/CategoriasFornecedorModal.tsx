/**
 * Cadastro e edição das categorias de fornecedor da empresa.
 *
 * Substitui o `ListManageModal` genérico que o formulário usava para categoria: aquele
 * gerenciava um array de strings no **localStorage**, então cada navegador tinha a sua lista.
 * Aqui as categorias são linhas da empresa, com id, código e estado — e o fornecedor aponta
 * para elas por `categoria_id`, com FK composta levando o `tenant_id` junto.
 *
 * Chama `useCategoriasFornecedor` por dentro, como o `CentrosCustoModal` e ao contrário do
 * `SeletorContaContabil`: é um gerenciador aberto sob demanda, uma instância por vez, que
 * precisa recarregar a própria lista depois de cada gravação.
 *
 * Vai para o `document.body` por `createPortal` porque é renderizado **dentro do `<form>`** do
 * formulário de fornecedor, que por sua vez está dentro de um overlay com `backdrop-blur` — e
 * `backdrop-filter` transforma o ancestral em bloco de contenção de descendentes `fixed` (a
 * lição do `AlterarSenhaModal`). O portal tira as duas armadilhas de uma vez.
 */
import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Pencil, Power, PowerOff, Check, Tags, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCategoriasFornecedor } from '../../hooks/useCategoriasFornecedor';
import { CategoriaFornecedorRegistro } from '../../types/categoriaFornecedor';
import {
  codigoDeCategoria,
  encontrarCategoriaComMesmoNome,
  nomeDeCategoriaParaGravacao,
} from '../../utils/categoriasFornecedor';

interface Props {
  onClose: () => void;
  /** Chamado depois de qualquer gravação, para a tela de fora recarregar o que depende disso. */
  onAlterou?: () => void;
  /** Falso deixa a lista só de leitura — mesma checagem de permissão da tela que abre. */
  podeEditar?: boolean;
}

interface FormState {
  id: string | null;
  nomeOriginal: string;
  nome: string;
  descricao: string;
}

export const CategoriasFornecedorModal: React.FC<Props> = ({
  onClose,
  onAlterou,
  podeEditar = true,
}) => {
  const { categorias, loading, error, salvar, desativar, reativar } = useCategoriasFornecedor();

  const [form, setForm] = useState<FormState | null>(null);
  const [salvando, setSalvando] = useState(false);

  const duplicada = useMemo(
    () => (form ? encontrarCategoriaComMesmoNome(categorias, form.nome, form.id) : undefined),
    [form, categorias],
  );

  // Renomear propaga o nome novo para os fornecedores daquela categoria — `categoria` não é
  // snapshot aqui. Dizer isso antes é o que evita a surpresa depois.
  const vaiRenomear = Boolean(
    form?.id && nomeDeCategoriaParaGravacao(form.nome) !== form.nomeOriginal,
  );

  const abrirNovo = () => setForm({ id: null, nomeOriginal: '', nome: '', descricao: '' });
  const abrirEdicao = (c: CategoriaFornecedorRegistro) =>
    setForm({ id: c.id, nomeOriginal: c.nome, nome: c.nome, descricao: c.descricao || '' });

  const handleSalvar = async () => {
    if (!form) return;
    const nome = nomeDeCategoriaParaGravacao(form.nome);
    if (!nome) {
      toast.error('Informe o nome da categoria.');
      return;
    }
    if (duplicada) {
      toast.error('Já existe uma categoria com esse nome nesta empresa.');
      return;
    }

    setSalvando(true);
    try {
      await salvar({ id: form.id || undefined, nome, descricao: form.descricao.trim() || null });
      toast.success(form.id ? 'Categoria atualizada.' : 'Categoria cadastrada.');
      setForm(null);
      onAlterou?.();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível salvar a categoria.');
    } finally {
      setSalvando(false);
    }
  };

  const alternarAtivo = async (c: CategoriaFornecedorRegistro) => {
    try {
      if (c.ativo) {
        await desativar(c);
        toast.success(`${c.nome} desativada. Os fornecedores que já a usam continuam intactos.`);
      } else {
        await reativar(c);
        toast.success(`${c.nome} reativada.`);
      }
      onAlterou?.();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível alterar a categoria.');
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl bg-bg-surface border border-border-default rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-default shrink-0">
          <h2 className="text-base font-bold text-text-base flex items-center gap-2">
            <Tags className="w-4 h-4 text-[#3B82F6]" />
            Categorias de Fornecedor
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-bg-base text-text-subtle transition-colors"
            title="Fechar"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-4 overflow-y-auto space-y-4">
          <p className="text-xs text-text-subtle">
            As categorias são desta empresa e valem para todos os operadores dela — antes a lista
            vivia no navegador de cada um. Desativar uma categoria tira ela do seletor de novos
            fornecedores, mas <b>não</b> altera os que já a usam; por isso não existe excluir.
          </p>

          {error && (
            <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-sm">
              {error}
            </div>
          )}

          {loading && <p className="text-sm text-text-subtle">Carregando categorias…</p>}

          {!loading && categorias.length === 0 && !form && (
            <div className="p-4 rounded-xl border border-border-default bg-bg-base text-sm text-text-subtle flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
              <span>
                Esta empresa ainda não tem nenhuma categoria cadastrada. Enquanto não houver, o
                formulário de fornecedor continua oferecendo a lista modelo.
              </span>
            </div>
          )}

          {!loading && categorias.length > 0 && (
            <ul className="divide-y divide-border-default border border-border-default rounded-xl overflow-hidden">
              {categorias.map((c) => (
                <li
                  key={c.id}
                  className={`flex items-center gap-3 px-4 py-2.5 bg-bg-base ${c.ativo ? '' : 'opacity-60'}`}
                >
                  <span className="font-mono text-xs text-text-muted w-48 shrink-0 truncate" title={c.codigo}>
                    {c.codigo}
                  </span>
                  <span className="flex-1 text-sm text-text-base truncate" title={c.descricao || c.nome}>
                    {c.nome}
                  </span>
                  {/*
                    A etiqueta fica FORA do span que trunca. Dentro dele, ela era a primeira
                    coisa cortada — some exatamente o que a linha existe para dizer, e sobra o
                    nome, que já estava visível. Foi o que a foto pegou.
                  */}
                  {!c.ativo && (
                    <span className="text-xs text-text-muted shrink-0">(desativada)</span>
                  )}
                  {/*
                    A área de ações é renderizada em toda linha, com largura fixa, mesmo vazia:
                    sem isso a coluna dança de linha em linha (a lição da foto do assistente de
                    reativação).
                  */}
                  <div className="flex items-center justify-end gap-1 shrink-0 w-[68px]">
                    {podeEditar && (
                      <>
                        <button
                          type="button"
                          onClick={() => abrirEdicao(c)}
                          className="p-1.5 rounded-lg hover:bg-bg-surface text-text-subtle transition-colors"
                          title="Renomear"
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
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {form && (
            <div className="p-4 rounded-xl border border-[#3B82F6]/40 bg-[#3B82F6]/5 space-y-3">
              <h3 className="text-sm font-bold text-text-base">
                {form.id ? 'Editar categoria' : 'Nova categoria'}
              </h3>

              <div>
                <label className="block text-xs font-medium text-text-subtle mb-1">Nome *</label>
                <input
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Urnas e Caixões"
                  autoFocus
                  className={`w-full bg-bg-base border rounded-xl px-3 py-2 text-sm text-text-base outline-none ${
                    duplicada ? 'border-rose-500' : 'border-border-default focus:border-[#3B82F6]'
                  }`}
                />
                {duplicada && (
                  <p className="text-rose-400 text-xs mt-1">
                    Já existe uma categoria com esse nome nesta empresa.
                  </p>
                )}
                {vaiRenomear && !duplicada && (
                  <p className="text-amber-400 text-xs mt-1">
                    Os fornecedores desta categoria passam a exibir o nome novo.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-text-subtle mb-1">
                  Código <span className="text-text-muted">(automático)</span>
                </label>
                {/*
                  O código vem do nome e não é digitável — e, numa categoria que já existe, não
                  muda nem quando o nome muda: é por ele que quem exportou relatório a reconhece.
                */}
                <input
                  value={
                    form.id
                      ? categorias.find((c) => c.id === form.id)?.codigo || ''
                      : codigoDeCategoria(form.nome)
                  }
                  readOnly
                  aria-readonly="true"
                  title={
                    form.id ? 'O código de uma categoria existente não muda.' : 'Gerado a partir do nome.'
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
                  disabled={salvando || Boolean(duplicada)}
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
              className="px-3 py-2 rounded-xl bg-[#3B82F6] hover:bg-blue-600 text-white text-sm font-bold flex items-center gap-1.5 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" /> Nova Categoria
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
    </div>,
    document.body,
  );
};
