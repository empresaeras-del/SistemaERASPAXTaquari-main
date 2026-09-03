import { Associado, Dependente } from '../services/associadosService';
import { PlanoPax } from '../types/planosPax';
import { Empresa } from '../services/empresasService';
import { Credenciado } from '../types/credenciados';
import { Atendimento } from '../types/atendimentos';
import { Fornecedor } from '../types/fornecedores';
import { Requisicao } from '../types/requisicoes';
import { Receita, ParcelaReceber } from '../services/financeiroService';
import { formatLocalDate } from './dateUtils';
import { formatCurrencyBRL } from './formatters';

/**
 * Fonte única das variáveis {{...}} de documentos padrão: cada módulo abaixo
 * declara, num só lugar, tanto os metadados exibidos no painel de "variáveis
 * disponíveis" quanto a função que resolve o valor real a partir de um
 * registro do módulo (Associado, Empresa, Atendimento...).
 *
 * Antes disso, a lista exibida (em DocumentosPadroesPage) e a resolução de
 * valores de verdade (em VisualizadorDocumentoPadraoModal) eram duas cópias
 * mantidas à mão em arquivos diferentes, e já haviam saído de sincronia:
 * havia variáveis resolvidas que não apareciam na lista (ex: variações de
 * carência do plano) e módulos inteiros (requisição, financeiro) que só
 * apareciam na lista mas nunca eram resolvidos de verdade.
 *
 * Como os campos de cada tipo (Associado, Empresa, etc.) são referenciados
 * diretamente dentro dos resolvers, renomear ou remover um campo do tipo
 * gera um erro de compilação aqui — o que força atualizar a variável de
 * documento correspondente no mesmo PR que muda o campo, em vez de deixar a
 * variável quebrada silenciosamente. Adicionar um campo novo, por natureza,
 * exige uma decisão humana (que rótulo, que formatação) e por isso não é
 * algo que dá pra sincronizar sozinho — mas o local certo pra tomar essa
 * decisão passou a ser só este arquivo.
 */

export interface VariavelInfo {
  variavel: string;
  label: string;
  descricao: string;
}

export interface ModuloInfo {
  id: string;
  label: string;
  icon: string;
  cor: string;
  variaveis: VariavelInfo[];
}

/* ─── Associado (+ Dependentes) ─────────────────────────────────────────── */

export const ASSOCIADO_VARIAVEIS: VariavelInfo[] = [
  { variavel: '{{associado_nome}}', label: 'Nome completo', descricao: 'Nome completo do associado' },
  { variavel: '{{associado_cpf}}', label: 'CPF', descricao: 'CPF do associado' },
  { variavel: '{{associado_rg}}', label: 'RG', descricao: 'Registro Geral do associado' },
  { variavel: '{{associado_data_nasc}}', label: 'Data de nascimento', descricao: 'Data de nascimento do associado' },
  { variavel: '{{associado_sexo}}', label: 'Sexo', descricao: 'Sexo do associado' },
  { variavel: '{{associado_nome_pai}}', label: 'Nome do pai', descricao: 'Nome do pai do associado' },
  { variavel: '{{associado_nome_mae}}', label: 'Nome da mãe', descricao: 'Nome da mãe do associado' },
  { variavel: '{{associado_telefone}}', label: 'Telefone', descricao: 'Telefone do associado' },
  { variavel: '{{associado_email}}', label: 'E-mail', descricao: 'E-mail do associado' },
  { variavel: '{{associado_endereco}}', label: 'Endereço completo', descricao: 'Logradouro, número, bairro, cidade e CEP' },
  { variavel: '{{associado_logradouro}}', label: 'Logradouro', descricao: 'Rua/Avenida do associado' },
  { variavel: '{{associado_numero}}', label: 'Número', descricao: 'Número do endereço' },
  { variavel: '{{associado_bairro}}', label: 'Bairro', descricao: 'Bairro do associado' },
  { variavel: '{{associado_cidade}}', label: 'Cidade', descricao: 'Cidade do associado' },
  { variavel: '{{associado_cep}}', label: 'CEP', descricao: 'CEP do associado' },
  { variavel: '{{associado_status}}', label: 'Status', descricao: 'Status do associado (ativo, inativo...)' },
  { variavel: '{{numero_contrato}}', label: 'Nº do contrato', descricao: 'Número do contrato do associado' },
  { variavel: '{{data_adesao}}', label: 'Data de adesão', descricao: 'Data de adesão do associado ao plano' },
  { variavel: '{{plano_atual}}', label: 'Plano atual', descricao: 'Nome do plano atual do associado' },
  { variavel: '{{valor_mensalidade}}', label: 'Valor da mensalidade', descricao: 'Valor mensal do plano do associado, formatado em R$' },
];

export const DEPENDENTES_VARIAVEIS: VariavelInfo[] = [
  { variavel: '{{associado_dependentes}}', label: 'Lista de dependentes', descricao: 'Nome, parentesco e CPF de cada dependente' },
  { variavel: '{{quantidade_dependentes}}', label: 'Qtd. de dependentes', descricao: 'Número total de dependentes vinculados' },
];

const formatarListaDependentes = (dependentes: Dependente[] | undefined): string => {
  if (!dependentes || dependentes.length === 0) return 'Nenhum dependente vinculado';
  return dependentes
    .map(d => `${d.nome} (${d.parentesco || 'Dependente'} - CPF: ${d.cpf || 'Não informado'})`)
    .join('<br/>');
};

export const resolverAssociado = (assoc: Associado): Record<string, string> => {
  const enderecoCompleto = [
    assoc.endereco_logradouro || assoc.logradouro,
    (assoc.endereco_numero || assoc.numero) ? `nº ${assoc.endereco_numero || assoc.numero}` : '',
    assoc.endereco_bairro || assoc.bairro,
    assoc.endereco_cidade || assoc.cidade,
    (assoc.endereco_cep || assoc.cep) ? `CEP: ${assoc.endereco_cep || assoc.cep}` : ''
  ].filter(Boolean).join(', ');

  return {
    '{{associado_nome}}': assoc.nome || '',
    '{{associado_cpf}}': assoc.cpf || '',
    '{{associado_rg}}': assoc.rg || '',
    '{{associado_data_nasc}}': assoc.data_nascimento ? formatLocalDate(assoc.data_nascimento) : '',
    '{{associado_sexo}}': assoc.sexo || '',
    '{{associado_nome_pai}}': assoc.nome_pai || '',
    '{{associado_nome_mae}}': assoc.nome_mae || '',
    '{{associado_telefone}}': assoc.telefone || '',
    '{{associado_email}}': assoc.email || '',
    '{{associado_endereco}}': enderecoCompleto,
    '{{associado_logradouro}}': assoc.endereco_logradouro || assoc.logradouro || '',
    '{{associado_numero}}': assoc.endereco_numero || assoc.numero || '',
    '{{associado_bairro}}': assoc.endereco_bairro || assoc.bairro || '',
    '{{associado_cidade}}': assoc.endereco_cidade || assoc.cidade || '',
    '{{associado_cep}}': assoc.endereco_cep || assoc.cep || '',
    '{{associado_status}}': (assoc.status || '').toUpperCase(),
    '{{numero_contrato}}': assoc.numero_contrato || assoc.id.substring(0, 8).toUpperCase(),
    '{{data_adesao}}': assoc.data_adesao ? formatLocalDate(assoc.data_adesao) : '',
    '{{plano_atual}}': assoc.plano_nome || '',
    '{{valor_mensalidade}}': assoc.valor_plano ? formatCurrencyBRL(assoc.valor_plano) : '',
    '{{associado_dependentes}}': formatarListaDependentes(assoc.dependentes),
    '{{quantidade_dependentes}}': (assoc.dependentes?.length || 0).toString(),
  };
};

/* ─── Plano PAX ──────────────────────────────────────────────────────────── */

export const PLANO_VARIAVEIS: VariavelInfo[] = [
  { variavel: '{{plano_nome}}', label: 'Nome do plano', descricao: 'Nome do plano contratado' },
  { variavel: '{{plano_codigo}}', label: 'Código do plano', descricao: 'Código identificador do plano' },
  { variavel: '{{plano_tipo}}', label: 'Tipo do plano', descricao: 'Individual ou Coletivo/Familiar' },
  { variavel: '{{valor_mensalidade}}', label: 'Valor da mensalidade', descricao: 'Valor mensal formatado em R$' },
  { variavel: '{{plano_taxa_adesao}}', label: 'Taxa de adesão', descricao: 'Valor da taxa de adesão ao plano' },
  { variavel: '{{plano_carencia_geral}}', label: 'Carência geral', descricao: 'Dias de carência geral do plano' },
  { variavel: '{{plano_carencia_acidente}}', label: 'Carência por acidente', descricao: 'Dias de carência para acidentes' },
  { variavel: '{{plano_carencia_morte_natural}}', label: 'Carência morte natural', descricao: 'Dias de carência para morte natural' },
  { variavel: '{{plano_limite_vidas}}', label: 'Limite de vidas', descricao: 'Número máximo de vidas no plano (ou "Ilimitado")' },
  { variavel: '{{plano_vigencia_inicio}}', label: 'Vigência início', descricao: 'Data de início de vigência do plano' },
  { variavel: '{{plano_vigencia_fim}}', label: 'Vigência fim', descricao: 'Data de fim de vigência do plano' },
];

export const resolverPlano = (plano: PlanoPax): Record<string, string> => ({
  '{{plano_nome}}': plano.nome || '',
  '{{plano_atual}}': plano.nome || '',
  '{{plano_codigo}}': plano.codigo || '',
  '{{plano_tipo}}': plano.tipo_plano === 'individual' ? 'Individual' : 'Coletivo / Familiar',
  '{{valor_mensalidade}}': plano.valor_mensalidade ? formatCurrencyBRL(plano.valor_mensalidade) : 'R$ 0,00',
  '{{plano_taxa_adesao}}': plano.taxa_adesao ? formatCurrencyBRL(plano.taxa_adesao) : 'R$ 0,00',
  '{{plano_carencia_geral}}': `${plano.carencia_geral_dias || 0} dias`,
  '{{plano_carencia_acidente}}': `${plano.carencia_acidente_dias || 0} dias`,
  '{{plano_carencia_morte_natural}}': `${plano.carencia_morte_natural_dias || 0} dias`,
  '{{plano_limite_vidas}}': plano.limite_vidas ? String(plano.limite_vidas) : 'Ilimitado',
  '{{plano_vigencia_inicio}}': plano.vigencia_inicio ? formatLocalDate(plano.vigencia_inicio) : '',
  '{{plano_vigencia_fim}}': plano.vigencia_fim ? formatLocalDate(plano.vigencia_fim) : '',
});

/* ─── Empresa Emissora ───────────────────────────────────────────────────── */

export const EMPRESA_VARIAVEIS: VariavelInfo[] = [
  { variavel: '{{empresa_nome}}', label: 'Nome da empresa', descricao: 'Nome fantasia da empresa emissora' },
  { variavel: '{{empresa_razao_social}}', label: 'Razão social', descricao: 'Razão social da empresa emissora' },
  { variavel: '{{empresa_cnpj}}', label: 'CNPJ', descricao: 'CNPJ da empresa emissora' },
  { variavel: '{{empresa_endereco}}', label: 'Endereço', descricao: 'Endereço da empresa emissora' },
  { variavel: '{{empresa_telefone}}', label: 'Telefone', descricao: 'Telefone da empresa emissora' },
  { variavel: '{{empresa_email}}', label: 'E-mail', descricao: 'E-mail da empresa emissora' },
  { variavel: '{{empresa_chave_pix}}', label: 'Chave PIX', descricao: 'Chave PIX da empresa emissora' },
];

export const resolverEmpresa = (emp: Empresa): Record<string, string> => ({
  '{{empresa_nome}}': emp.nome_fantasia || emp.razao_social || '',
  '{{empresa_razao_social}}': emp.razao_social || emp.nome_fantasia || '',
  '{{empresa_cnpj}}': emp.cnpj || '',
  '{{empresa_endereco}}': emp.endereco || '',
  '{{empresa_telefone}}': emp.telefone || '',
  '{{empresa_email}}': emp.email || '',
  '{{empresa_chave_pix}}': emp.chave_pix || '',
});

/* ─── Credenciado ────────────────────────────────────────────────────────── */

export const CREDENCIADO_VARIAVEIS: VariavelInfo[] = [
  { variavel: '{{credenciado_nome}}', label: 'Nome/Razão social', descricao: 'Razão social do credenciado' },
  { variavel: '{{credenciado_fantasia}}', label: 'Nome fantasia', descricao: 'Nome fantasia do credenciado' },
  { variavel: '{{credenciado_cnpj}}', label: 'CNPJ/CPF', descricao: 'CNPJ ou CPF do credenciado' },
  { variavel: '{{credenciado_endereco}}', label: 'Endereço', descricao: 'Endereço completo do credenciado' },
  { variavel: '{{credenciado_cidade}}', label: 'Cidade', descricao: 'Cidade e UF do credenciado' },
  { variavel: '{{credenciado_telefone}}', label: 'Telefone', descricao: 'Telefone do credenciado' },
  { variavel: '{{credenciado_email}}', label: 'E-mail', descricao: 'E-mail do credenciado' },
  { variavel: '{{credenciado_responsavel}}', label: 'Responsável', descricao: 'Nome do responsável técnico' },
  { variavel: '{{credenciado_ramo}}', label: 'Ramo de atividade', descricao: 'Ramo de atividade do credenciado' },
  { variavel: '{{credenciado_chave_pix}}', label: 'Chave PIX', descricao: 'Chave PIX do credenciado' },
];

export const resolverCredenciado = (cred: Credenciado): Record<string, string> => {
  const enderecoCompleto = [
    cred.endereco,
    cred.numero ? `nº ${cred.numero}` : '',
    cred.complemento,
    cred.bairro,
    cred.cidade,
    cred.estado,
    cred.cep ? `CEP: ${cred.cep}` : ''
  ].filter(Boolean).join(', ');

  return {
    '{{credenciado_nome}}': cred.razao_social || cred.nome_fantasia || '',
    '{{credenciado_fantasia}}': cred.nome_fantasia || cred.razao_social || '',
    '{{credenciado_cnpj}}': cred.cnpj_cpf || '',
    '{{credenciado_endereco}}': enderecoCompleto,
    '{{credenciado_cidade}}': cred.cidade ? `${cred.cidade}${cred.estado ? ' - ' + cred.estado : ''}` : '',
    '{{credenciado_telefone}}': cred.telefone || '',
    '{{credenciado_email}}': cred.email || '',
    '{{credenciado_responsavel}}': cred.responsavel_nome || '',
    '{{credenciado_ramo}}': cred.ramo_atividade || '',
    '{{credenciado_chave_pix}}': cred.chave_pix || '',
  };
};

/* ─── Atendimento / Óbito ────────────────────────────────────────────────── */

export const ATENDIMENTO_VARIAVEIS: VariavelInfo[] = [
  { variavel: '{{falecido_nome}}', label: 'Nome do falecido', descricao: 'Nome do falecido registrado no atendimento' },
  { variavel: '{{falecido_cpf}}', label: 'CPF do falecido', descricao: 'CPF do falecido' },
  { variavel: '{{falecido_data_nascimento}}', label: 'Data nascimento (falecido)', descricao: 'Data de nascimento do falecido' },
  { variavel: '{{data_obito}}', label: 'Data do óbito', descricao: 'Data do falecimento' },
  { variavel: '{{local_velorio}}', label: 'Local do velório', descricao: 'Local onde será o velório' },
  { variavel: '{{local_sepultamento}}', label: 'Local de sepultamento', descricao: 'Cemitério / Local de sepultamento' },
  { variavel: '{{data_velorio}}', label: 'Data do velório', descricao: 'Data do velório' },
  { variavel: '{{data_sepultamento}}', label: 'Data do sepultamento', descricao: 'Data do sepultamento' },
  { variavel: '{{atendimento_valor}}', label: 'Valor total', descricao: 'Valor total do atendimento funerário' },
  { variavel: '{{atendimento_status}}', label: 'Status', descricao: 'Status do atendimento (aberto, concluído...)' },
];

export const resolverAtendimento = (atd: Atendimento): Record<string, string> => ({
  '{{falecido_nome}}': atd.falecido_nome || '',
  '{{falecido_cpf}}': atd.falecido_cpf || '',
  '{{falecido_data_nascimento}}': atd.falecido_data_nascimento ? formatLocalDate(atd.falecido_data_nascimento) : '',
  '{{data_obito}}': atd.data_obito ? formatLocalDate(atd.data_obito) : '',
  '{{local_velorio}}': atd.local_velorio || '',
  '{{local_sepultamento}}': atd.local_sepultamento || '',
  '{{data_velorio}}': atd.data_velorio ? formatLocalDate(atd.data_velorio) : '',
  '{{data_sepultamento}}': atd.data_sepultamento ? formatLocalDate(atd.data_sepultamento) : '',
  '{{atendimento_valor}}': atd.valor_total ? formatCurrencyBRL(atd.valor_total) : 'R$ 0,00',
  '{{atendimento_status}}': (atd.status || '').toUpperCase(),
});

/* ─── Requisição / Guia ──────────────────────────────────────────────────── */

export const REQUISICAO_VARIAVEIS: VariavelInfo[] = [
  { variavel: '{{requisicao_codigo}}', label: 'Código da requisição', descricao: 'Código único (ex: REQ-2026-001)' },
  { variavel: '{{requisicao_data}}', label: 'Data de emissão', descricao: 'Data de emissão da requisição' },
  { variavel: '{{requisicao_validade}}', label: 'Data de validade', descricao: 'Data de validade da requisição' },
  { variavel: '{{paciente_nome}}', label: 'Nome do paciente', descricao: 'Nome do paciente (titular ou dependente)' },
  { variavel: '{{paciente_cpf}}', label: 'CPF do paciente', descricao: 'CPF do paciente' },
  { variavel: '{{paciente_tipo}}', label: 'Tipo de paciente', descricao: 'Titular ou dependente' },
  { variavel: '{{medico_solicitante}}', label: 'Médico solicitante', descricao: 'Nome do médico solicitante' },
  { variavel: '{{crm_solicitante}}', label: 'CRM do médico', descricao: 'CRM do médico solicitante' },
  { variavel: '{{requisicao_valor}}', label: 'Valor total', descricao: 'Valor total da requisição' },
  { variavel: '{{requisicao_copart}}', label: 'Coparticipação', descricao: 'Valor total de coparticipação' },
];

export const resolverRequisicao = (req: Requisicao): Record<string, string> => ({
  '{{requisicao_codigo}}': req.codigo_requisicao || '',
  '{{requisicao_data}}': req.data_emissao ? formatLocalDate(req.data_emissao) : '',
  '{{requisicao_validade}}': req.data_validade ? formatLocalDate(req.data_validade) : '',
  '{{paciente_nome}}': req.paciente_nome || '',
  '{{paciente_cpf}}': req.paciente_cpf || '',
  '{{paciente_tipo}}': req.paciente_tipo === 'titular' ? 'Titular' : 'Dependente',
  '{{medico_solicitante}}': req.medico_solicitante || '',
  '{{crm_solicitante}}': req.crm_solicitante || '',
  '{{requisicao_valor}}': formatCurrencyBRL(req.valor_total),
  '{{requisicao_copart}}': formatCurrencyBRL(req.valor_coparticipacao_total || 0),
});

/* ─── Financeiro / Pagamentos ────────────────────────────────────────────── */

export const FINANCEIRO_VARIAVEIS: VariavelInfo[] = [
  { variavel: '{{parcela_numero}}', label: 'Nº da parcela', descricao: 'Número da parcela (ex: 1/12)' },
  { variavel: '{{parcela_valor}}', label: 'Valor da parcela', descricao: 'Valor da parcela formatado em R$' },
  { variavel: '{{parcela_vencimento}}', label: 'Vencimento', descricao: 'Data de vencimento da parcela' },
  { variavel: '{{receita_descricao}}', label: 'Descrição da receita', descricao: 'Descrição do lançamento de receita' },
  { variavel: '{{receita_categoria}}', label: 'Categoria', descricao: 'Categoria do lançamento financeiro' },
  { variavel: '{{receita_valor_total}}', label: 'Valor total', descricao: 'Valor total do lançamento' },
  { variavel: '{{forma_pagamento}}', label: 'Forma de pagamento', descricao: 'Forma de pagamento (PIX, boleto...)' },
];

export const resolverFinanceiro = (parcela: ParcelaReceber, receita?: Receita | null): Record<string, string> => ({
  '{{parcela_numero}}': receita ? `${parcela.numero_parcela}/${receita.qtd_parcelas}` : String(parcela.numero_parcela),
  '{{parcela_valor}}': formatCurrencyBRL(parcela.valor),
  '{{parcela_vencimento}}': parcela.data_vencimento ? formatLocalDate(parcela.data_vencimento) : '',
  '{{receita_descricao}}': receita?.descricao || parcela.descricao || '',
  '{{receita_categoria}}': receita?.categoria || '',
  '{{receita_valor_total}}': receita ? formatCurrencyBRL(receita.valor_total) : formatCurrencyBRL(parcela.valor),
  '{{forma_pagamento}}': parcela.forma_pagamento || receita?.forma_pagamento_padrao || '',
});

/* ─── Fornecedor ─────────────────────────────────────────────────────────── */

export const FORNECEDOR_VARIAVEIS: VariavelInfo[] = [
  { variavel: '{{fornecedor_nome}}', label: 'Razão social', descricao: 'Razão social do fornecedor' },
  { variavel: '{{fornecedor_fantasia}}', label: 'Nome fantasia', descricao: 'Nome fantasia do fornecedor' },
  { variavel: '{{fornecedor_cnpj}}', label: 'CNPJ/CPF', descricao: 'CNPJ ou CPF do fornecedor' },
  { variavel: '{{fornecedor_endereco}}', label: 'Endereço', descricao: 'Endereço completo do fornecedor' },
  { variavel: '{{fornecedor_cidade}}', label: 'Cidade', descricao: 'Cidade e UF do fornecedor' },
  { variavel: '{{fornecedor_telefone}}', label: 'Telefone', descricao: 'Telefone do fornecedor' },
  { variavel: '{{fornecedor_email}}', label: 'E-mail', descricao: 'E-mail do fornecedor' },
  { variavel: '{{fornecedor_contato}}', label: 'Contato', descricao: 'Nome do contato no fornecedor' },
  { variavel: '{{fornecedor_chave_pix}}', label: 'Chave PIX', descricao: 'Chave PIX do fornecedor' },
];

export const resolverFornecedor = (forn: Fornecedor): Record<string, string> => {
  const enderecoCompleto = [
    forn.logradouro,
    forn.numero ? `nº ${forn.numero}` : '',
    forn.complemento,
    forn.bairro,
    forn.cidade,
    forn.uf,
    forn.cep ? `CEP: ${forn.cep}` : ''
  ].filter(Boolean).join(', ');

  return {
    '{{fornecedor_nome}}': forn.razao_social || forn.nome_fantasia || '',
    '{{fornecedor_fantasia}}': forn.nome_fantasia || forn.razao_social || '',
    '{{fornecedor_cnpj}}': forn.cnpj_cpf || '',
    '{{fornecedor_endereco}}': enderecoCompleto,
    '{{fornecedor_cidade}}': forn.cidade ? `${forn.cidade}${forn.uf ? ' - ' + forn.uf : ''}` : '',
    '{{fornecedor_telefone}}': forn.telefone || forn.celular_whatsapp || '',
    '{{fornecedor_email}}': forn.email || '',
    '{{fornecedor_contato}}': forn.contato_nome || '',
    '{{fornecedor_chave_pix}}': forn.dados_bancarios?.chave_pix || '',
  };
};

/* ─── Sistema / Data (sintético, resolvido no momento da emissão) ──────────── */

export const SISTEMA_VARIAVEIS: VariavelInfo[] = [
  { variavel: '{{data_atual}}', label: 'Data atual', descricao: 'Data atual no momento da emissão' },
  { variavel: '{{hora_atual}}', label: 'Hora atual', descricao: 'Hora atual no momento da emissão' },
  { variavel: '{{data_hora_atual}}', label: 'Data e hora atual', descricao: 'Data e hora completas de emissão' },
  { variavel: '{{mes_atual}}', label: 'Mês atual', descricao: 'Nome do mês atual por extenso' },
  { variavel: '{{ano_atual}}', label: 'Ano atual', descricao: 'Ano atual (ex: 2026)' },
];

export const resolverSistema = (agora: Date = new Date()): Record<string, string> => ({
  '{{data_atual}}': formatLocalDate(agora),
  '{{hora_atual}}': agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
  '{{data_hora_atual}}': `${formatLocalDate(agora)} às ${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
  '{{mes_atual}}': agora.toLocaleDateString('pt-BR', { month: 'long' }),
  '{{ano_atual}}': agora.getFullYear().toString(),
});

/* ─── Agregado para o painel de variáveis disponíveis ───────────────────────── */

export const MODULOS: ModuloInfo[] = [
  { id: 'associado', label: 'Associado', icon: '👤', cor: '#3B82F6', variaveis: ASSOCIADO_VARIAVEIS },
  { id: 'dependentes', label: 'Dependentes', icon: '👨‍👩‍👧', cor: '#8B5CF6', variaveis: DEPENDENTES_VARIAVEIS },
  { id: 'plano', label: 'Plano PAX', icon: '💳', cor: '#10B981', variaveis: PLANO_VARIAVEIS },
  { id: 'empresa', label: 'Empresa Emissora', icon: '🏢', cor: '#F59E0B', variaveis: EMPRESA_VARIAVEIS },
  { id: 'credenciado', label: 'Credenciado', icon: '🏥', cor: '#EF4444', variaveis: CREDENCIADO_VARIAVEIS },
  { id: 'atendimento', label: 'Atendimento / Óbito', icon: '🕯️', cor: '#64748B', variaveis: ATENDIMENTO_VARIAVEIS },
  { id: 'requisicao', label: 'Requisição / Guia', icon: '📋', cor: '#06B6D4', variaveis: REQUISICAO_VARIAVEIS },
  { id: 'financeiro', label: 'Financeiro / Pagamentos', icon: '💰', cor: '#22C55E', variaveis: FINANCEIRO_VARIAVEIS },
  { id: 'fornecedor', label: 'Fornecedor', icon: '🚚', cor: '#F97316', variaveis: FORNECEDOR_VARIAVEIS },
  { id: 'sistema', label: 'Sistema / Data', icon: '🖥️', cor: '#94A3B8', variaveis: SISTEMA_VARIAVEIS },
];
