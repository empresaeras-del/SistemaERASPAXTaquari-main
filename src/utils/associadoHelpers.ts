import { Associado, Dependente } from '../services/associadosService';

/**
 * Funções puras extraídas de pages/Associados.tsx — comportamento idêntico ao
 * código original, só relocadas para poder ser testadas isoladamente sem
 * precisar montar o componente. Ver CLAUDE.md, seção "God components".
 */

export type OrdenacaoAssociados = 'nome_asc' | 'nome_desc' | 'adesao_asc' | 'adesao_desc';

export interface FiltrosAssociados {
  searchTerm: string;
  statusFilter: string;
  planoFilter: string;
  sortBy: OrdenacaoAssociados | string;
}

/**
 * Filtra por nome/CPF (busca aceita nome, CPF formatado ou só dígitos),
 * status e plano, depois ordena pelo critério escolhido. Não muta o array
 * de entrada.
 */
export const filtrarEOrdenarAssociados = (
  associados: Associado[],
  { searchTerm, statusFilter, planoFilter, sortBy }: FiltrosAssociados
): Associado[] => {
  const result = associados.filter((a) => {
    if (!a) return false;
    const s = (searchTerm || '').trim().toLowerCase();
    const sDigits = s.replace(/\D/g, '');
    const nome = (a.nome || '').toLowerCase();
    const cpf = a.cpf || '';
    const cpfDigits = cpf.replace(/\D/g, '');

    const matchesSearch = !s ||
      nome.includes(s) ||
      (sDigits.length > 0 && cpfDigits.includes(sDigits)) ||
      cpf.includes(s);
    const matchesStatus = statusFilter ? a.status === statusFilter : true;
    const matchesPlano = planoFilter ? a.plano_pax_id === planoFilter : true;
    return matchesSearch && matchesStatus && matchesPlano;
  });

  switch (sortBy) {
    case 'nome_asc':
      result.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
      break;
    case 'nome_desc':
      result.sort((a, b) => (b.nome || '').localeCompare(a.nome || ''));
      break;
    case 'adesao_asc':
      result.sort((a, b) => new Date(a.data_adesao || 0).getTime() - new Date(b.data_adesao || 0).getTime());
      break;
    case 'adesao_desc':
      result.sort((a, b) => new Date(b.data_adesao || 0).getTime() - new Date(a.data_adesao || 0).getTime());
      break;
  }
  return result;
};

export interface DependenteComTitular extends Dependente {
  titular_nome: string;
  titular_status: Associado['status'];
}

/** Achata os dependentes de todos os associados numa única lista, anotando o titular de cada um. */
export const extrairTodosDependentes = (associados: Associado[]): DependenteComTitular[] => {
  const deps: DependenteComTitular[] = [];
  associados.forEach(a => {
    if (a && a.dependentes && Array.isArray(a.dependentes)) {
      a.dependentes.forEach(d => {
        deps.push({
          ...d,
          titular_nome: a.nome,
          titular_status: a.status
        });
      });
    }
  });
  return deps;
};

/** Filtra a lista achatada de dependentes por nome do dependente ou do titular. */
export const filtrarDependentes = (
  dependentes: DependenteComTitular[],
  busca: string
): DependenteComTitular[] => {
  return dependentes.filter(d => {
    if (!d) return false;
    const q = (busca || '').toLowerCase();
    const nome = (d.nome || '').toLowerCase();
    const titular = (d.titular_nome || '').toLowerCase();
    return !q || nome.includes(q) || titular.includes(q);
  });
};

export interface EstatisticasAssociados {
  totalTitulares: number;
  totalDependentes: number;
  vidasProtegidas: number;
  inadimplentes: number;
  qtdAssociadosAtivosSemParcelas: number;
}

/** Estatísticas do topo da página de Associados (cards de resumo). */
export const calcularEstatisticasAssociados = (
  associados: Associado[],
  parcelasAbertasMap: Record<string, number>
): EstatisticasAssociados => {
  const totalTitulares = associados.length;
  const totalDependentes = associados.reduce((acc, a) => acc + (a.dependentes?.length || 0), 0);
  const vidasProtegidas = totalTitulares + totalDependentes;
  const inadimplentes = associados.filter((a) => a.status === 'inadimplente').length;
  const qtdAssociadosAtivosSemParcelas = associados.filter(
    (a) => a.status === 'ativo' && (parcelasAbertasMap[a.id] || 0) === 0
  ).length;

  return { totalTitulares, totalDependentes, vidasProtegidas, inadimplentes, qtdAssociadosAtivosSemParcelas };
};

/**
 * Procura, entre os associados ATIVOS (excluindo o próprio registro sendo
 * salvo), algum com o mesmo CPF já cadastrado. Usado para bloquear duplicidade
 * ao salvar.
 */
export const encontrarAssociadoComCpfDuplicado = (
  associados: Associado[],
  cpf: string,
  excludeId?: string
): Associado | undefined => {
  const cpfLimpo = (cpf || '').replace(/\D/g, '');
  if (cpfLimpo.length === 0) return undefined;
  return associados.find(a =>
    a &&
    a.status === 'ativo' &&
    a.cpf?.replace(/\D/g, '') === cpfLimpo &&
    a.id !== excludeId
  );
};

export interface NVidasEIdades {
  nVidas: number;
  idadesDependentes: number[];
}

/**
 * Conta as vidas do plano (titular + dependentes) e calcula a idade de cada
 * dependente a partir da data de nascimento — usado tanto para exibir o valor
 * do plano em tempo real quanto ao salvar o associado.
 */
export const calcularNVidasEIdades = (dependentes: Dependente[] | undefined): NVidasEIdades => {
  const deps = dependentes || [];
  const idadesDependentes = deps.map(d => {
    if (d && d.data_nascimento) {
      const bdate = new Date(d.data_nascimento);
      return new Date().getFullYear() - bdate.getFullYear();
    }
    return 0;
  });
  return { nVidas: 1 + deps.length, idadesDependentes };
};

export interface HistoricoContratoEntrada {
  id: string;
  plano: string;
  valor: number;
  data_inicio: string;
  data_fim?: string;
}

/**
 * Monta a entrada de histórico de contrato quando o plano de um associado é
 * trocado — registra o plano anterior com a data em que deixou de valer.
 */
export const construirEntradaHistoricoContrato = (
  original: Pick<Associado, 'plano_nome' | 'valor_plano' | 'data_adesao'>,
  novoId: string,
  dataFimISO: string
): HistoricoContratoEntrada => ({
  id: novoId,
  plano: original.plano_nome || 'Anterior',
  valor: original.valor_plano || 0,
  data_inicio: original.data_adesao,
  data_fim: dataFimISO
});

export interface ViaCepResponse {
  erro?: boolean;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
}

/**
 * Aplica o retorno do ViaCEP a um associado em edição — só substitui
 * logradouro/bairro/cidade se a API retornou valor preenchido, preservando o
 * que o usuário já tinha digitado quando o CEP não tem esse dado.
 */
export const aplicarEnderecoViaCep = <T extends Partial<Associado>>(
  prev: T,
  data: ViaCepResponse,
  cepFormatado: string
): T => {
  const logr = (data.logradouro || '').toUpperCase().trim();
  const bai = (data.bairro || '').toUpperCase().trim();
  const cid = (data.localidade ? `${data.localidade}${data.uf ? ' - ' + data.uf : ''}` : '').toUpperCase().trim();
  const est = (data.uf || '').toUpperCase().trim();

  return {
    ...prev,
    endereco_cep: cepFormatado,
    cep: cepFormatado,
    endereco_logradouro: logr || prev.endereco_logradouro || prev.logradouro || '',
    logradouro: logr || prev.endereco_logradouro || prev.logradouro || '',
    endereco_bairro: bai || prev.endereco_bairro || prev.bairro || '',
    bairro: bai || prev.endereco_bairro || prev.bairro || '',
    endereco_cidade: cid || prev.endereco_cidade || prev.cidade || '',
    cidade: cid || prev.endereco_cidade || prev.cidade || '',
    municipio: data.localidade?.toUpperCase().trim() || prev.cidade || prev.endereco_cidade || '',
    endereco_estado: est || prev.endereco_estado || prev.uf || '',
    uf: est || prev.endereco_estado || prev.uf || ''
  };
};

/**
 * Aplica uma mudança de campo do formulário de associado: maiusculiza texto
 * (exceto email/senha/status), mascara CEP, e sincroniza os pares de alias de
 * endereço (endereco_logradouro/logradouro etc. — ver "Schema drift conhecido"
 * no CLAUDE.md). Não decide showToast/side-effects — isso continua no
 * componente, que decide o que fazer com o objeto retornado.
 */
export const aplicarMudancaCampoAssociado = <T extends Record<string, any>>(
  current: T,
  field: keyof Associado,
  value: any
): T => {
  const fieldStr = field as string;
  let finalValue = (typeof value === 'string' && fieldStr !== 'email' && fieldStr !== 'senha' && fieldStr !== 'status')
    ? value.toUpperCase()
    : value;

  if (field === 'endereco_cep' || field === 'cep') {
    const rawCep = (value || '').replace(/\D/g, '');
    finalValue = rawCep.replace(/^(\d{5})(\d)/, '$1-$2').substring(0, 9);
  }

  const updated: any = {
    ...current,
    [field]: finalValue
  };

  if (field === 'endereco_logradouro' || field === 'logradouro') {
    updated.endereco_logradouro = finalValue;
    updated.logradouro = finalValue;
  } else if (field === 'endereco_numero' || field === 'numero') {
    updated.endereco_numero = finalValue;
    updated.numero = finalValue;
  } else if (field === 'endereco_bairro' || field === 'bairro') {
    updated.endereco_bairro = finalValue;
    updated.bairro = finalValue;
  } else if (field === 'endereco_cidade' || field === 'cidade' || fieldStr === 'municipio') {
    updated.endereco_cidade = finalValue;
    updated.cidade = finalValue;
    updated.municipio = finalValue;
  } else if (field === 'endereco_cep' || field === 'cep') {
    updated.endereco_cep = finalValue;
    updated.cep = finalValue;
  } else if (field === 'endereco_estado' || field === 'uf') {
    updated.endereco_estado = finalValue;
    updated.uf = finalValue;
  }

  return updated as T;
};
