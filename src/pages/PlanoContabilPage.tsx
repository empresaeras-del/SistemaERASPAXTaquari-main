import React, { useMemo, useState } from 'react';
import {
  BookOpen, Plus, Pencil, Power, PowerOff, ChevronRight, ChevronDown,
  Sparkles, Search, TrendingUp, TrendingDown, X, CalendarRange, AlertTriangle,
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { usePlanoContabil } from '../hooks/usePlanoContabil';
import { canEditFinanceiro } from '../utils/permissions';
import { ContaContabil, ContaContabilNode, NaturezaContabil } from '../types/planoContabil';
import {
  achatarArvore,
  proximoCodigo,
  validarConta,
  ErroValidacaoConta,
  codigoDoPai,
} from '../utils/planoContabilTree';
import { contemTermo } from '../utils/normalizarTexto';

interface FormState {
  id: string | null;
  codigo: string;
  nome: string;
  descricao: string;
  natureza: NaturezaContabil;
  tipo: 'sintetica' | 'analitica';
  conta_pai_id: string | null;
}

const FORM_VAZIO: FormState = {
  id: null,
  codigo: '',
  nome: '',
  descricao: '',
  natureza: 'receita',
  tipo: 'analitica',
  conta_pai_id: null,
};

export const PlanoContabilPage: React.FC = () => {
  const { state } = useAppContext();
  const toast = useToast();
  const {
    plano, contas, arvore, loading, error,
    salvarConta, desativarConta, reativarConta, semearPlanoPadrao, paisPossiveis,
    planos, exercicioExibido, exercicioCorrente, faltaExercicioCorrente,
    selecionarExercicio, duplicarParaExercicio,
  } = usePlanoContabil();

  const [busca, setBusca] = useState('');
  const [recolhidas, setRecolhidas] = useState<Set<string>>(new Set());
  const [mostrarInativas, setMostrarInativas] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [erros, setErros] = useState<ErroValidacaoConta[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [semeando, setSemeando] = useState(false);
  const [duplicando, setDuplicando] = useState(false);

  const podeEditar = canEditFinanceiro(state.user, state.isOnline);

  const duplicarExercicio = async () => {
    setDuplicando(true);
    try {
      const { contas: copiadas } = await duplicarParaExercicio(exercicioCorrente);
      toast.success(`Plano de ${exercicioCorrente} criado com ${copiadas.length} contas copiadas.`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível copiar o plano.');
    } finally {
      setDuplicando(false);
    }
  };

  const linhas = useMemo(() => {
    const todas = achatarArvore(arvore);
    const termo = busca.trim();

    return todas.filter((n) => {
      if (!mostrarInativas && !n.ativo) return false;
      if (termo && !contemTermo(`${n.codigo} ${n.nome}`, termo)) return false;

      // com busca ativa a árvore é achatada: mostrar tudo que casa, sem esconder por pai recolhido
      if (termo) return true;

      let paiId = n.conta_pai_id;
      const vistos = new Set<string>();
      while (paiId && !vistos.has(paiId)) {
        vistos.add(paiId);
        if (recolhidas.has(paiId)) return false;
        paiId = contas.find((c) => c.id === paiId)?.conta_pai_id || null;
      }
      return true;
    });
  }, [arvore, contas, busca, recolhidas, mostrarInativas]);

  const toggleRecolher = (id: string) => {
    setRecolhidas((atual) => {
      const proxima = new Set(atual);
      if (proxima.has(id)) proxima.delete(id);
      else proxima.add(id);
      return proxima;
    });
  };

  const abrirNova = (pai?: ContaContabil) => {
    const natureza = pai?.natureza || 'receita';
    setErros([]);
    setForm({
      ...FORM_VAZIO,
      natureza,
      conta_pai_id: pai?.id || null,
      codigo: proximoCodigo(contas, pai?.codigo || null),
      tipo: 'analitica',
    });
  };

  const abrirEdicao = (conta: ContaContabil) => {
    setErros([]);
    setForm({
      id: conta.id,
      codigo: conta.codigo,
      nome: conta.nome,
      descricao: conta.descricao || '',
      natureza: conta.natureza,
      tipo: conta.tipo,
      conta_pai_id: conta.conta_pai_id || null,
    });
  };

  const handleSemear = async () => {
    setSemeando(true);
    try {
      const { contas: criadas } = await semearPlanoPadrao();
      toast.success(`Plano de contas criado com ${criadas.length} contas.`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível criar o plano de contas.');
    } finally {
      setSemeando(false);
    }
  };

  const handleSalvar = async () => {
    if (!form) return;
    const encontrados = validarConta(form, contas);
    setErros(encontrados);
    if (encontrados.length > 0) return;

    setSalvando(true);
    try {
      await salvarConta({
        id: form.id || undefined,
        codigo: form.codigo.trim(),
        nome: form.nome.trim(),
        descricao: form.descricao.trim() || null,
        natureza: form.natureza,
        tipo: form.tipo,
        conta_pai_id: form.conta_pai_id,
      });
      toast.success(form.id ? 'Conta atualizada.' : 'Conta criada.');
      setForm(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar a conta.');
    } finally {
      setSalvando(false);
    }
  };

  const handleAlternarAtiva = async (conta: ContaContabil) => {
    try {
      if (conta.ativo) {
        await desativarConta(conta);
        toast.success(`Conta ${conta.codigo} desativada. Os lançamentos que já a usam continuam intactos.`);
      } else {
        await reativarConta(conta);
        toast.success(`Conta ${conta.codigo} reativada.`);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao alterar a conta.');
    }
  };

  const erroDo = (campo: ErroValidacaoConta['campo']) => erros.find((e) => e.campo === campo)?.mensagem;

  const opcoesPai = form ? paisPossiveis(form.natureza, form.id) : [];

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-text-base flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#3B82F6]" />
            Plano de Contas Contábeis
          </h1>
          <p className="text-sm text-text-subtle">
            Estrutura de receitas e despesas da empresa. Contas <b>analíticas</b> são as que aparecem
            como categoria nos lançamentos; <b>sintéticas</b> apenas agrupam e totalizam.
          </p>
        </div>

        {plano && podeEditar && (
          <button
            onClick={() => abrirNova()}
            className="px-4 py-2 bg-[#3B82F6] hover:bg-blue-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-blue-500/20 self-start"
          >
            <Plus className="w-4 h-4" /> Nova Conta
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-sm">
          {error}
        </div>
      )}

      {plano && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl border border-border-default bg-bg-surface">
          <div className="flex items-center gap-2">
            <CalendarRange className="w-4 h-4 text-[#3B82F6] shrink-0" />
            <label htmlFor="exercicio-plano" className="text-sm font-medium text-text-subtle">
              Exercício
            </label>
            <select
              id="exercicio-plano"
              value={exercicioExibido}
              onChange={(e) => selecionarExercicio(Number(e.target.value))}
              className="bg-bg-base border border-border-default rounded-lg px-3 py-1.5 text-sm text-text-base focus:border-[#3B82F6] outline-none"
            >
              {planos.map((p) => (
                <option key={p.id} value={p.exercicio}>
                  {p.exercicio}
                </option>
              ))}
            </select>
          </div>

          {/*
            O plano de um exercício fechado continua existindo com os lançamentos daquele ano
            pendurados nele. Por isso duplicar copia, nunca move — e por isso a tela avisa
            quando o exercício corrente ainda não foi montado, em vez de mostrar em silêncio o
            plano do ano passado como se fosse o de agora.
          */}
          {faltaExercicioCorrente && podeEditar && (
            <div className="flex items-center gap-2 text-xs text-amber-400 sm:ml-auto">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>Ainda não há plano para {exercicioCorrente}.</span>
              <button
                onClick={duplicarExercicio}
                disabled={duplicando}
                className="px-2.5 py-1 rounded-lg bg-[#3B82F6] hover:bg-blue-600 disabled:opacity-60 text-white font-bold"
              >
                {duplicando ? 'Copiando…' : `Copiar para ${exercicioCorrente}`}
              </button>
            </div>
          )}
        </div>
      )}

      {loading && <div className="text-sm text-text-subtle">Carregando plano de contas…</div>}

      {!loading && !plano && (
        <div className="p-8 rounded-2xl border border-border-default bg-bg-surface text-center space-y-3">
          <Sparkles className="w-8 h-8 text-[#3B82F6] mx-auto" />
          <h2 className="text-base font-bold text-text-base">Esta empresa ainda não tem plano de contas</h2>
          <p className="text-sm text-text-subtle max-w-lg mx-auto">
            Dá para começar com o modelo padrão do sistema — ele já vem com os grupos de receita e
            despesa mais comuns e pode ser renomeado, ampliado ou desativado depois. As contas são
            criadas <b>desta empresa</b>, não compartilhadas com as demais.
          </p>
          {podeEditar ? (
            <button
              onClick={handleSemear}
              disabled={semeando}
              className="px-5 py-2.5 bg-[#3B82F6] hover:bg-blue-600 disabled:opacity-60 text-white rounded-xl text-sm font-bold inline-flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              {semeando ? 'Criando…' : 'Criar a partir do modelo padrão'}
            </button>
          ) : (
            <p className="text-xs text-text-muted">
              Você não tem permissão para criar o plano de contas
              {state.isOnline === false ? ' (modo offline)' : ''}.
            </p>
          )}
        </div>
      )}

      {!loading && plano && (
        <>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por código ou nome da conta…"
                className="w-full bg-bg-surface border border-border-default rounded-xl pl-9 pr-4 py-2.5 text-sm text-text-base focus:border-[#3B82F6] outline-none"
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-text-subtle whitespace-nowrap">
              <input
                type="checkbox"
                checked={mostrarInativas}
                onChange={(e) => setMostrarInativas(e.target.checked)}
                className="accent-[#3B82F6]"
              />
              Mostrar contas desativadas
            </label>
          </div>

          <div className="rounded-2xl border border-border-default bg-bg-surface overflow-hidden">
            {linhas.length === 0 ? (
              <div className="p-8 text-center text-sm text-text-subtle">
                Nenhuma conta encontrada para esse filtro.
              </div>
            ) : (
              <ul className="divide-y divide-border-default">
                {linhas.map((node: ContaContabilNode) => {
                  const temFilhas = node.filhas.length > 0;
                  const recolhida = recolhidas.has(node.id);
                  const indent = Math.min((node.nivel || 1) - 1, 5);

                  return (
                    <li
                      key={node.id}
                      className={`flex items-center gap-2 px-3 py-2.5 hover:bg-bg-hover ${!node.ativo ? 'opacity-50' : ''}`}
                      style={{ paddingLeft: `${12 + indent * 20}px` }}
                    >
                      <button
                        onClick={() => temFilhas && toggleRecolher(node.id)}
                        className={`p-0.5 rounded ${temFilhas ? 'text-text-muted hover:text-text-base' : 'invisible'}`}
                        aria-label={recolhida ? 'Expandir' : 'Recolher'}
                        aria-expanded={temFilhas ? !recolhida : undefined}
                      >
                        {recolhida ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>

                      <span className="font-mono text-xs text-text-muted w-20 shrink-0">{node.codigo}</span>

                      <span
                        className={`text-sm truncate ${node.tipo === 'sintetica' ? 'font-bold text-text-base' : 'text-text-subtle'}`}
                        title={node.descricao || node.nome}
                      >
                        {node.nome}
                      </span>

                      {node.natureza === 'receita' ? (
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" aria-label="Receita" />
                      ) : (
                        <TrendingDown className="w-3.5 h-3.5 text-rose-400 shrink-0" aria-label="Despesa" />
                      )}

                      {node.tipo === 'sintetica' && (
                        <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border border-border-default text-text-muted shrink-0">
                          grupo
                        </span>
                      )}
                      {!node.ativo && (
                        <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border border-amber-500/30 text-amber-400 shrink-0">
                          desativada
                        </span>
                      )}

                      {podeEditar && (
                        <div className="ml-auto flex items-center gap-1 shrink-0">
                          {node.tipo === 'sintetica' && (
                            <button
                              onClick={() => abrirNova(node)}
                              className="p-1.5 rounded-lg text-text-muted hover:text-[#3B82F6] hover:bg-[#3B82F6]/10"
                              title="Adicionar conta dentro deste grupo"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => abrirEdicao(node)}
                            className="p-1.5 rounded-lg text-text-muted hover:text-[#3B82F6] hover:bg-[#3B82F6]/10"
                            title="Editar conta"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleAlternarAtiva(node)}
                            className="p-1.5 rounded-lg text-text-muted hover:text-amber-400 hover:bg-amber-500/10"
                            title={node.ativo ? 'Desativar conta' : 'Reativar conta'}
                          >
                            {node.ativo ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <p className="text-xs text-text-muted">
            {contas.filter((c) => c.tipo === 'analitica' && c.ativo).length} contas lançáveis ·{' '}
            {contas.filter((c) => c.tipo === 'sintetica').length} grupos · plano <b>{plano.nome}</b> ·{' '}
            exercício <b>{plano.exercicio}</b>
          </p>
        </>
      )}

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg bg-bg-surface border border-border-default rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-default">
              <h2 className="text-base font-bold text-text-base">
                {form.id ? 'Editar Conta Contábil' : 'Nova Conta Contábil'}
              </h2>
              <button
                onClick={() => setForm(null)}
                className="p-1 rounded-lg text-text-muted hover:text-text-base hover:bg-bg-hover"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-subtle mb-1">Natureza</label>
                  <select
                    value={form.natureza}
                    onChange={(e) =>
                      setForm({ ...form, natureza: e.target.value as NaturezaContabil, conta_pai_id: null })
                    }
                    className="w-full bg-bg-base border border-border-default rounded-xl px-3 py-2 text-sm text-text-base focus:border-[#3B82F6] outline-none"
                  >
                    <option value="receita">Receita</option>
                    <option value="despesa">Despesa</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-subtle mb-1">Tipo</label>
                  <select
                    value={form.tipo}
                    onChange={(e) => setForm({ ...form, tipo: e.target.value as FormState['tipo'] })}
                    className="w-full bg-bg-base border border-border-default rounded-xl px-3 py-2 text-sm text-text-base focus:border-[#3B82F6] outline-none"
                  >
                    <option value="analitica">Analítica (recebe lançamento)</option>
                    <option value="sintetica">Sintética (só agrupa)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-subtle mb-1">Conta pai (grupo)</label>
                <select
                  value={form.conta_pai_id || ''}
                  onChange={(e) => {
                    const paiId = e.target.value || null;
                    const pai = contas.find((c) => c.id === paiId);
                    setForm({
                      ...form,
                      conta_pai_id: paiId,
                      codigo:
                        form.id || codigoDoPai(form.codigo) === (pai?.codigo || null)
                          ? form.codigo
                          : proximoCodigo(contas, pai?.codigo || null),
                    });
                  }}
                  className="w-full bg-bg-base border border-border-default rounded-xl px-3 py-2 text-sm text-text-base focus:border-[#3B82F6] outline-none"
                >
                  <option value="">Nenhuma (conta de primeiro nível)</option>
                  {opcoesPai.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.codigo} — {c.nome}
                    </option>
                  ))}
                </select>
                {erroDo('conta_pai_id') && (
                  <p className="text-rose-400 text-xs mt-1">{erroDo('conta_pai_id')}</p>
                )}
                {erroDo('natureza') && <p className="text-rose-400 text-xs mt-1">{erroDo('natureza')}</p>}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-subtle mb-1">
                    Código{' '}
                    <span className="text-text-muted" title="O código segue a posição da conta na árvore">
                      (automático)
                    </span>
                  </label>
                  {/*
                    Codificação imposta: o código vem da conta pai e da próxima posição livre
                    abaixo dela, e não é digitável. Código livre deixava criar "3.1.01" dentro
                    de "4.2" — a árvore desenhada pelos códigos passava a discordar da árvore
                    real de `conta_pai_id`, e o relatório por grupo saía errado sem nenhum
                    aviso. O código de uma conta que já existe também não muda: é por ele que
                    quem exportou relatório reconhece a conta.
                  */}
                  <input
                    value={form.codigo}
                    readOnly
                    aria-readonly="true"
                    placeholder="3.1.01"
                    title={
                      form.id
                        ? 'O código de uma conta existente não muda.'
                        : 'Gerado a partir da conta pai escolhida acima.'
                    }
                    className={`w-full bg-bg-surface/60 border rounded-xl px-3 py-2 text-sm font-mono text-text-muted outline-none cursor-not-allowed ${
                      erroDo('codigo') ? 'border-rose-500' : 'border-border-default'
                    }`}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-text-subtle mb-1">Nome</label>
                  <input
                    value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                    placeholder="Mensalidades de Planos"
                    className={`w-full bg-bg-base border rounded-xl px-3 py-2 text-sm text-text-base outline-none ${
                      erroDo('nome') ? 'border-rose-500' : 'border-border-default focus:border-[#3B82F6]'
                    }`}
                  />
                </div>
              </div>
              {erroDo('codigo') && <p className="text-rose-400 text-xs -mt-2">{erroDo('codigo')}</p>}
              {erroDo('nome') && <p className="text-rose-400 text-xs -mt-2">{erroDo('nome')}</p>}

              <div>
                <label className="block text-xs font-medium text-text-subtle mb-1">
                  Descrição <span className="text-text-muted">(opcional)</span>
                </label>
                <textarea
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  rows={2}
                  className="w-full bg-bg-base border border-border-default rounded-xl px-3 py-2 text-sm text-text-base focus:border-[#3B82F6] outline-none resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 px-6 py-4 border-t border-border-default">
              <button
                onClick={() => setForm(null)}
                className="px-4 py-2 rounded-xl text-sm text-text-subtle hover:bg-bg-hover"
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvar}
                disabled={salvando}
                className="px-5 py-2 bg-[#3B82F6] hover:bg-blue-600 disabled:opacity-60 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20"
              >
                {salvando ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
