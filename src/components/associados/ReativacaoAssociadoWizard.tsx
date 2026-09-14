import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  FileSignature,
  FileText,
  RotateCcw,
  Users,
  X,
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { usePlanosPax } from '../../hooks/usePlanosPax';
import { useDocumentosPadroes } from '../../hooks/useDocumentosPadroes';
import { Associado } from '../../services/associadosService';
import { getEmpresas, getEmpresaById, Empresa } from '../../services/empresasService';
import {
  reativarAssociadoComNovoContrato,
  ResultadoReativacao,
} from '../../services/reativacaoService';
import {
  dependentesMarcadosPorPadrao,
  dependentesParaReativacao,
  gerarNumeroContratoReativacao,
  gerarProjecaoParcelas,
  vidasDaReativacao,
} from '../../utils/reativacaoAssociado';
import { formatCurrency } from '../../utils/formatters';
import { formatarDocumento, idadeEmAnos } from '../../utils/resumoAssociado';
import { DocumentoPadrao } from '../../types/documentos';
import { VisualizadorDocumentoPadraoModal } from '../documentos/VisualizadorDocumentoPadraoModal';
import {
  resolverVariaveisAssociado,
  resolverVariaveisContrato,
  resolverVariaveisEmpresa,
  resolverVariaveisSistema,
} from '../../utils/documentoVariaveis';

interface Props {
  associado: Associado;
  onClose: () => void;
  /** Chamado depois de a reativação ter sido gravada, para a tela recarregar a lista. */
  onSuccess: (resultado: ResultadoReativacao) => void;
}

const ETAPAS = [
  { num: 1, label: 'Cadastro', icone: FileText },
  { num: 2, label: 'Dependentes', icone: Users },
  { num: 3, label: 'Plano', icone: FileSignature },
  { num: 4, label: 'Mensalidades', icone: CalendarDays },
  { num: 5, label: 'Contrato', icone: FileSignature },
] as const;

const Campo: React.FC<{ rotulo: string; children: React.ReactNode }> = ({ rotulo, children }) => (
  <label className="block">
    <span className="text-[11px] uppercase tracking-wider font-bold text-text-subtle">
      {rotulo}
    </span>
    <div className="mt-1">{children}</div>
  </label>
);

const entrada =
  'w-full px-3 py-2.5 bg-bg-base border border-border-default rounded-xl text-sm text-text-base focus:border-[#3B82F6] outline-none transition-colors';

const SoLeitura: React.FC<{ rotulo: string; valor?: string | null }> = ({ rotulo, valor }) => (
  <Campo rotulo={rotulo}>
    <p className="px-3 py-2.5 rounded-xl bg-bg-base/60 border border-dashed border-border-default text-sm text-text-base truncate">
      {valor && valor.trim() !== '' ? valor : '—'}
    </p>
  </Campo>
);

/**
 * Reativação de um associado inativo, por etapas.
 *
 * O pedido foi "um processo parecido com o cadastro de um associado novo, aproveitando os
 * dados que já existem" — e é literalmente isso: o cadastro e os dependentes vêm prontos e
 * só se confere, mas o **contrato é novo do zero** (plano, número, data, mensalidades),
 * porque a adesão anterior terminou na inativação e o contrato dela virou histórico.
 *
 * A tela decide **quando**; o que cada passo produz é função pura em
 * `utils/reativacaoAssociado.ts`, e quem grava é `services/reativacaoService.ts`.
 */
export const ReativacaoAssociadoWizard: React.FC<Props> = ({ associado, onClose, onSuccess }) => {
  const toast = useToast();
  const { state } = useAppContext();
  const { planosAtivos, planos: planosCompletos, calcularValor } = usePlanosPax();
  const { documentos, loading: carregandoModelos } = useDocumentosPadroes();

  const [etapa, setEtapa] = useState(1);
  const [salvando, setSalvando] = useState(false);

  // Etapa 1 — o cadastro vem pronto; só o contato é editável, que é o que muda enquanto
  // alguém está fora. Nome, CPF e nascimento são identidade e se corrigem no cadastro.
  const [cadastro, setCadastro] = useState<Associado>(associado);
  const alterarCadastro = (campo: keyof Associado, valor: string) =>
    setCadastro((atual) => ({ ...atual, [campo]: valor }));

  // Etapa 2
  const dependentes = useMemo(() => dependentesParaReativacao(associado), [associado]);
  const [selecionados, setSelecionados] = useState<string[]>(() =>
    dependentesMarcadosPorPadrao(dependentesParaReativacao(associado)),
  );
  const alternarDependente = (id: string) =>
    setSelecionados((atual) =>
      atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id],
    );

  // Etapa 3
  const [planoId, setPlanoId] = useState<string>(associado.plano_pax_id || '');
  const [dataAdesao, setDataAdesao] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [numeroContrato] = useState<string>(() => gerarNumeroContratoReativacao());
  // Começa em zero de propósito: quem volta não está aderindo pela primeira vez, e cobrar
  // a adesão de novo por omissão seria uma decisão de preço que ninguém tomou.
  const [taxaAdesao, setTaxaAdesao] = useState<string>('0');

  // Etapa 4
  const [dataInicio, setDataInicio] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [qtdParcelas, setQtdParcelas] = useState<number>(12);
  const [diaVencimento, setDiaVencimento] = useState<number>(10);

  // Etapa 5
  const [modeloId, setModeloId] = useState<string>('');
  const [empresaData, setEmpresaData] = useState<Empresa | null>(null);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [documentoGerado, setDocumentoGerado] = useState<DocumentoPadrao | null>(null);
  const [variaveisDocumento, setVariaveisDocumento] = useState<Record<string, string>>({});
  const [reativado, setReativado] = useState<Associado | null>(null);

  useEffect(() => {
    getEmpresas(state.isOnline)
      .then(async (lista) => {
        setEmpresas(lista);
        const tenantId = state.empresaSelecionada || associado.tenant_id;
        const encontrada =
          lista.find((e) => e.id === tenantId) ||
          (tenantId ? await getEmpresaById(tenantId, state.isOnline) : null);
        if (encontrada) setEmpresaData(encontrada);
      })
      .catch((e) => console.error('Erro ao carregar empresas na reativação:', e));
  }, [state.isOnline, state.empresaSelecionada, associado.tenant_id]);

  const planoSelecionado = useMemo(
    () => (planosCompletos || []).find((p) => p.id === planoId),
    [planosCompletos, planoId],
  );

  const { nVidas, idadesDependentes } = useMemo(
    () => vidasDaReativacao(dependentes, selecionados),
    [dependentes, selecionados],
  );

  const valorMensalidade = useMemo(() => {
    if (!planoSelecionado) return 0;
    return calcularValor(planoSelecionado, nVidas, idadesDependentes, 0).total;
  }, [planoSelecionado, nVidas, idadesDependentes, calcularValor]);

  const taxaAdesaoNumero = useMemo(() => {
    const n = Number(String(taxaAdesao).replace(',', '.'));
    return isNaN(n) || n < 0 ? 0 : n;
  }, [taxaAdesao]);

  const ultrapassaLimite = useMemo(() => {
    if (!planoSelecionado || planoSelecionado.tipo_plano !== 'coletivo') return false;
    return nVidas > (planoSelecionado.limite_vidas || 999);
  }, [planoSelecionado, nVidas]);

  const parcelas = useMemo(() => {
    if (!planoSelecionado) return [];
    return gerarProjecaoParcelas({
      dataInicioISO: dataInicio,
      qtdParcelas,
      diaVencimento,
      baseParcela: valorMensalidade,
      taxaAdesao: taxaAdesaoNumero,
      planoNome: planoSelecionado.nome,
      formatarData: (d) => format(d, 'yyyy-MM-dd'),
    });
  }, [
    planoSelecionado,
    dataInicio,
    qtdParcelas,
    diaVencimento,
    valorMensalidade,
    taxaAdesaoNumero,
  ]);

  const totalContrato = useMemo(
    () => parcelas.reduce((acc, p) => acc + p.valor, 0),
    [parcelas],
  );

  const modelosAtivos = useMemo(() => documentos.filter((d) => d.ativo), [documentos]);

  const podeAvancar = useMemo(() => {
    if (etapa === 3) return Boolean(planoId) && !ultrapassaLimite;
    if (etapa === 4) return parcelas.length > 0;
    return true;
  }, [etapa, planoId, ultrapassaLimite, parcelas.length]);

  /**
   * Gera o contrato no visualizador, com as variáveis já resolvidas.
   *
   * Roda **depois** da gravação e a partir do associado já reativado: o documento tem de
   * dizer o número, o plano e o valor do contrato novo. Montá-lo antes imprimiria os dados
   * do contrato que acabou de virar histórico.
   */
  const gerarContrato = (associadoReativado: Associado) => {
    const modelo = modelosAtivos.find((d) => d.id === modeloId);
    if (!modelo) return;

    const vars: Record<string, string> = {
      ...resolverVariaveisSistema(),
      ...(empresaData ? resolverVariaveisEmpresa(empresaData) : {}),
      ...resolverVariaveisAssociado(associadoReativado),
      ...resolverVariaveisContrato(associadoReativado),
      '{{valor_mensalidade}}': formatCurrency(valorMensalidade),
      '{{contrato_valor_mensalidade}}': formatCurrency(valorMensalidade),
    };

    const encontradas = [...(modelo.conteudo || '').matchAll(/\{\{([^}]+)\}\}/g)];
    const iniciais: Record<string, string> = {};
    encontradas.forEach((m) => {
      iniciais[m[0]] = vars[m[0]] !== undefined ? vars[m[0]] : '';
    });

    setVariaveisDocumento(iniciais);
    setDocumentoGerado(modelo);
  };

  const finalizar = async () => {
    if (!planoSelecionado) return;
    setSalvando(true);
    try {
      const resultado = await reativarAssociadoComNovoContrato(
        {
          associado: cadastro,
          idsDependentesReativados: selecionados,
          planoId,
          planoNome: planoSelecionado.nome,
          valorPlano: valorMensalidade,
          taxaAdesao: taxaAdesaoNumero,
          numeroContrato,
          dataAdesao,
          qtdParcelas,
          parcelas,
        },
        {
          isOnline: state.isOnline,
          empresaSelecionada: state.empresaSelecionada,
          userTenantId: state.user?.tenant_id,
          userId: state.user?.id,
        },
      );

      setReativado(resultado.associado);
      toast.success(
        `Associado reativado — contrato ${resultado.numeroContrato}, ` +
          `${resultado.parcelasGeradas} mensalidade(s) gerada(s).`,
      );
      // O contrato é gerado antes de avisar a tela de fora: `onSuccess` recarrega a lista e
      // o visualizador continua aberto por cima, que é o que o operador espera imprimir.
      gerarContrato(resultado.associado);
      onSuccess(resultado);
    } catch (erro) {
      console.error('Erro ao reativar associado', erro);
      const detalhe = erro instanceof Error ? erro.message : '';
      toast.error(detalhe || 'Erro ao reativar o associado.');
    } finally {
      setSalvando(false);
    }
  };

  const concluido = Boolean(reativado);

  return (
    <div className="fixed inset-0 z-[120] bg-bg-base/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-bg-surface w-full max-w-4xl rounded-3xl shadow-2xl flex flex-col max-h-[92vh] border border-border-default overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-border-default">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl shrink-0">
              <RotateCcw className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-text-base truncate">Reativação de Associado</h2>
              <p className="text-sm text-text-subtle truncate">
                {associado.nome} — o cadastro é aproveitado, o contrato é novo
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-text-subtle hover:bg-bg-hover rounded-lg transition-colors shrink-0"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center px-6 py-4 border-b border-border-default bg-bg-subtle/50 overflow-x-auto">
          {ETAPAS.map((e, i) => (
            <React.Fragment key={e.num}>
              <div
                className={`flex items-center gap-2 shrink-0 ${
                  etapa === e.num
                    ? 'text-[#3B82F6]'
                    : etapa > e.num
                      ? 'text-emerald-500'
                      : 'text-text-muted'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                    etapa === e.num
                      ? 'border-[#3B82F6] bg-[#3B82F6]/10'
                      : etapa > e.num
                        ? 'border-emerald-500 bg-emerald-500/10'
                        : 'border-border-default bg-bg-surface'
                  }`}
                >
                  {etapa > e.num ? <CheckCircle2 className="w-4 h-4" /> : e.num}
                </div>
                <span className="font-semibold text-sm hidden md:inline">{e.label}</span>
              </div>
              {i < ETAPAS.length - 1 && (
                <ChevronRight className="w-4 h-4 text-border-default mx-2 shrink-0" />
              )}
            </React.Fragment>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {etapa === 1 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-bold text-text-base">Confira o cadastro</h3>
                <p className="text-sm text-text-subtle mt-1">
                  Os dados já existem e não precisam ser redigitados. Corrija o contato se ele
                  mudou enquanto o cadastro esteve inativo.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <SoLeitura rotulo="Nome" valor={cadastro.nome} />
                <SoLeitura rotulo="CPF" valor={formatarDocumento(cadastro.cpf)} />
                <SoLeitura
                  rotulo="Nascimento"
                  valor={
                    idadeEmAnos(cadastro.data_nascimento) !== null
                      ? `${cadastro.data_nascimento} (${idadeEmAnos(cadastro.data_nascimento)} anos)`
                      : cadastro.data_nascimento
                  }
                />
                <SoLeitura rotulo="RG" valor={cadastro.rg} />

                <Campo rotulo="Telefone">
                  <input
                    type="text"
                    className={entrada}
                    value={cadastro.telefone || ''}
                    onChange={(e) => alterarCadastro('telefone', e.target.value)}
                  />
                </Campo>
                <Campo rotulo="WhatsApp">
                  <input
                    type="text"
                    className={entrada}
                    value={cadastro.celular_whatsapp || ''}
                    onChange={(e) => alterarCadastro('celular_whatsapp', e.target.value)}
                  />
                </Campo>
                <Campo rotulo="E-mail">
                  <input
                    type="email"
                    className={entrada}
                    value={cadastro.email || ''}
                    onChange={(e) => alterarCadastro('email', e.target.value)}
                  />
                </Campo>
                <Campo rotulo="Logradouro">
                  <input
                    type="text"
                    className={entrada}
                    value={cadastro.endereco_logradouro || ''}
                    onChange={(e) => alterarCadastro('endereco_logradouro', e.target.value)}
                  />
                </Campo>
                <Campo rotulo="Número">
                  <input
                    type="text"
                    className={entrada}
                    value={cadastro.endereco_numero || ''}
                    onChange={(e) => alterarCadastro('endereco_numero', e.target.value)}
                  />
                </Campo>
                <Campo rotulo="Bairro">
                  <input
                    type="text"
                    className={entrada}
                    value={cadastro.endereco_bairro || ''}
                    onChange={(e) => alterarCadastro('endereco_bairro', e.target.value)}
                  />
                </Campo>
                <Campo rotulo="Cidade">
                  <input
                    type="text"
                    className={entrada}
                    value={cadastro.endereco_cidade || ''}
                    onChange={(e) => alterarCadastro('endereco_cidade', e.target.value)}
                  />
                </Campo>
                <Campo rotulo="UF">
                  <input
                    type="text"
                    maxLength={2}
                    className={entrada}
                    value={cadastro.endereco_estado || ''}
                    onChange={(e) => alterarCadastro('endereco_estado', e.target.value)}
                  />
                </Campo>
              </div>

              <div className="rounded-2xl border border-border-default bg-bg-base/50 p-4">
                <h4 className="text-[11px] uppercase tracking-wider font-bold text-text-subtle mb-2">
                  Contrato anterior — vai para o histórico
                </h4>
                <div className="grid sm:grid-cols-3 gap-3 text-sm">
                  <p className="text-text-base">
                    <span className="text-text-subtle">Plano: </span>
                    {associado.plano_nome || '—'}
                  </p>
                  <p className="text-text-base">
                    <span className="text-text-subtle">Número: </span>
                    {associado.numero_contrato || '—'}
                  </p>
                  <p className="text-text-base">
                    <span className="text-text-subtle">Adesão: </span>
                    {associado.data_adesao || '—'}
                  </p>
                </div>
                <p className="text-[11px] text-text-subtle mt-2">
                  As parcelas canceladas na inativação continuam canceladas — elas são de um
                  período sem cobertura.
                </p>
              </div>
            </div>
          )}

          {etapa === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-bold text-text-base">Quem volta a ser coberto</h3>
                <p className="text-sm text-text-subtle mt-1">
                  Desmarque quem não deve voltar — um dependente falecido, por exemplo. Quem
                  ficar desmarcado continua inativo no cadastro, sem ser excluído.
                </p>
              </div>

              {dependentes.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-text-subtle rounded-2xl border border-dashed border-border-default">
                  Este associado não tem dependentes. O contrato cobre apenas o titular.
                </p>
              ) : (
                <ul className="rounded-2xl border border-border-default divide-y divide-border-default overflow-hidden">
                  {dependentes.map((d) => {
                    const marcado = selecionados.includes(d.id);
                    return (
                      <li key={d.id} className="bg-bg-base/40">
                        <label className="flex items-center gap-3 px-4 py-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={marcado}
                            onChange={() => alternarDependente(d.id)}
                            className="w-4 h-4 accent-emerald-500 shrink-0"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-text-base truncate">
                              {d.nome}
                            </span>
                            <span className="block text-[11px] text-text-subtle">
                              {d.parentesco || 'Sem parentesco'}
                              {d.idade !== null ? ` • ${d.idade} anos` : ''}
                              {d.jaAtivo ? ' • já estava ativo' : ''}
                            </span>
                          </span>
                          <span
                            className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                              marcado
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : 'bg-text-subtle/10 text-text-subtle border-text-subtle/30'
                            }`}
                          >
                            {marcado ? 'Coberto' : 'Fica inativo'}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}

              <p className="text-sm text-text-base">
                <span className="font-bold">{nVidas}</span> vida(s) no contrato novo — o titular
                mais {nVidas - 1} dependente(s).
              </p>
            </div>
          )}

          {etapa === 3 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-bold text-text-base">Plano e contrato novos</h3>
                <p className="text-sm text-text-subtle mt-1">
                  O contrato anterior é arquivado; este nasce com número e data próprios.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <Campo rotulo="Plano">
                  <select
                    className={entrada}
                    value={planoId}
                    onChange={(e) => setPlanoId(e.target.value)}
                  >
                    <option value="">Selecione o plano...</option>
                    {planosAtivos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome} — {formatCurrency(p.valor_mensalidade)}
                      </option>
                    ))}
                  </select>
                </Campo>
                <Campo rotulo="Data de adesão">
                  <input
                    type="date"
                    className={entrada}
                    value={dataAdesao}
                    onChange={(e) => setDataAdesao(e.target.value)}
                  />
                </Campo>
                <SoLeitura rotulo="Número do contrato" valor={numeroContrato} />
                <Campo rotulo="Taxa de adesão (R$)">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className={entrada}
                    value={taxaAdesao}
                    onChange={(e) => setTaxaAdesao(e.target.value)}
                  />
                </Campo>
              </div>

              {planoSelecionado && (
                <div className="rounded-2xl border border-[#3B82F6]/30 bg-[#3B82F6]/5 p-4">
                  <p className="text-sm text-text-subtle">Mensalidade calculada</p>
                  <p className="text-2xl font-extrabold text-text-base mt-0.5">
                    {formatCurrency(valorMensalidade)}
                  </p>
                  <p className="text-[11px] text-text-subtle mt-1">
                    {nVidas} vida(s)
                    {taxaAdesaoNumero > 0
                      ? ` • adesão de ${formatCurrency(taxaAdesaoNumero)} na 1ª parcela`
                      : ' • sem taxa de adesão'}
                  </p>
                </div>
              )}

              {ultrapassaLimite && (
                <p className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-300">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
                  <span>
                    O plano coletivo escolhido cobre até {planoSelecionado?.limite_vidas} vidas e
                    este contrato tem {nVidas}. Escolha outro plano ou revise os dependentes.
                  </span>
                </p>
              )}
            </div>
          )}

          {etapa === 4 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-bold text-text-base">Mensalidades do contrato novo</h3>
                <p className="text-sm text-text-subtle mt-1">
                  Serão criadas em Contas a Receber ao concluir a reativação.
                </p>
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <Campo rotulo="Início da cobrança">
                  <input
                    type="date"
                    className={entrada}
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                  />
                </Campo>
                <Campo rotulo="Parcelas">
                  <input
                    type="number"
                    min={1}
                    max={60}
                    className={entrada}
                    value={qtdParcelas}
                    onChange={(e) => setQtdParcelas(Number(e.target.value) || 1)}
                  />
                </Campo>
                <Campo rotulo="Dia do vencimento">
                  <input
                    type="number"
                    min={1}
                    max={28}
                    className={entrada}
                    value={diaVencimento}
                    onChange={(e) => setDiaVencimento(Number(e.target.value) || 1)}
                  />
                </Campo>
              </div>

              <div className="rounded-2xl border border-border-default overflow-hidden">
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-bg-base/60 sticky top-0">
                      <tr>
                        <th className="text-left px-4 py-2 text-[11px] uppercase tracking-wider font-bold text-text-subtle">
                          Parcela
                        </th>
                        <th className="text-left px-4 py-2 text-[11px] uppercase tracking-wider font-bold text-text-subtle">
                          Vencimento
                        </th>
                        <th className="text-right px-4 py-2 text-[11px] uppercase tracking-wider font-bold text-text-subtle">
                          Valor
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-default">
                      {parcelas.map((p) => (
                        <tr key={p.numero_parcela}>
                          <td className="px-4 py-2 text-text-base">{p.descricao}</td>
                          <td className="px-4 py-2 text-text-base tabular-nums">
                            {p.data_vencimento}
                          </td>
                          <td className="px-4 py-2 text-right text-text-base font-semibold tabular-nums">
                            {formatCurrency(p.valor)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between px-4 py-3 border-t border-border-default bg-bg-base/40">
                  <span className="text-sm text-text-subtle">
                    {parcelas.length} parcela(s)
                  </span>
                  <span className="text-base font-extrabold text-text-base tabular-nums">
                    {formatCurrency(totalContrato)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {etapa === 5 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-bold text-text-base">Contrato a emitir</h3>
                <p className="text-sm text-text-subtle mt-1">
                  Escolha o modelo padrão. Ao concluir, o contrato é gerado preenchido com os
                  dados deste associado e do contrato novo.
                </p>
              </div>

              <Campo rotulo="Modelo de documento">
                <select
                  className={entrada}
                  value={modeloId}
                  onChange={(e) => setModeloId(e.target.value)}
                  disabled={carregandoModelos}
                >
                  <option value="">Selecione um modelo...</option>
                  {modelosAtivos.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nome} ({d.tipo.replace(/_/g, ' ').toUpperCase()})
                    </option>
                  ))}
                </select>
              </Campo>

              {!modeloId && !carregandoModelos && (
                <p className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-300">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
                  <span>
                    Sem modelo escolhido a reativação é concluída do mesmo jeito, mas nenhum
                    contrato é gerado — você teria de emiti-lo depois pelo cadastro.
                  </span>
                </p>
              )}

              <div className="rounded-2xl border border-border-default bg-bg-base/50 p-4 space-y-1.5">
                <h4 className="text-[11px] uppercase tracking-wider font-bold text-text-subtle">
                  Resumo da reativação
                </h4>
                <p className="text-sm text-text-base">
                  <span className="text-text-subtle">Associado: </span>
                  {cadastro.nome}
                </p>
                <p className="text-sm text-text-base">
                  <span className="text-text-subtle">Plano: </span>
                  {planoSelecionado?.nome || '—'} • {nVidas} vida(s)
                </p>
                <p className="text-sm text-text-base">
                  <span className="text-text-subtle">Contrato: </span>
                  {numeroContrato} • adesão em {dataAdesao}
                </p>
                <p className="text-sm text-text-base">
                  <span className="text-text-subtle">Mensalidades: </span>
                  {parcelas.length}x — total {formatCurrency(totalContrato)}
                </p>
                {dependentes.length - (nVidas - 1) > 0 && (
                  <p className="text-sm text-amber-300">
                    {dependentes.length - (nVidas - 1)} dependente(s) permanecem inativos.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 p-5 border-t border-border-default bg-bg-subtle/40">
          <button
            type="button"
            onClick={() => (etapa === 1 ? onClose() : setEtapa((e) => e - 1))}
            disabled={salvando || concluido}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-text-subtle hover:text-text-base hover:bg-bg-hover transition-colors disabled:opacity-50"
          >
            {etapa === 1 ? 'Cancelar' : 'Voltar'}
          </button>

          {etapa < ETAPAS.length ? (
            <button
              type="button"
              onClick={() => setEtapa((e) => e + 1)}
              disabled={!podeAvancar}
              className="px-5 py-2.5 bg-[#3B82F6] hover:bg-[#2563EB] text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-all flex items-center gap-2 shadow-lg shadow-[#3B82F6]/20"
            >
              Avançar
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : concluido ? (
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold transition-all flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              Concluído — fechar
            </button>
          ) : (
            <button
              type="button"
              onClick={finalizar}
              disabled={salvando || !planoId}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20"
            >
              <RotateCcw className="w-4 h-4" />
              {salvando ? 'Reativando...' : 'Reativar e gerar contrato'}
            </button>
          )}
        </div>
      </div>

      <VisualizadorDocumentoPadraoModal
        isOpen={Boolean(documentoGerado)}
        onClose={() => setDocumentoGerado(null)}
        documento={documentoGerado}
        empresaData={empresaData}
        empresas={empresas}
        associados={reativado ? [reativado] : []}
        initialPlaceholderValues={variaveisDocumento}
        customTitle={`${documentoGerado?.nome || 'Contrato'} • ${cadastro.nome}`}
      />
    </div>
  );
};
