/**
 * Resolução de variáveis {{...}} dos Documentos Padrões — fonte única.
 *
 * Antes, cada um dos três lugares que preenchem um documento (a página de
 * modelos, o visualizador/impressão e os geradores de contrato/atendimento)
 * reimplementava seu próprio mapa entidade → variável, com pequenas
 * divergências entre eles. Estas funções puras substituem as três cópias:
 * cada uma recebe uma entidade e devolve um `Record<string, string>` pronto
 * para ser espalhado sobre o mapa de valores de placeholder.
 */
import { Empresa } from '../services/empresasService';
import { Associado, Dependente } from '../services/associadosService';
import { Atendimento } from '../types/atendimentos';
import { PlanoPax } from '../types/planosPax';
import { Credenciado } from '../types/credenciados';
import { Fornecedor } from '../types/fornecedores';
import { Contrato } from '../types/contrato';
import { Usuario } from '../types';
import { Receita, Despesa, ParcelaReceber, ParcelaPagar } from '../services/financeiroService';
import { Requisicao } from '../types/requisicoes';
import { formatLocalDate } from './dateUtils';

const formatBRL = (val?: number | null): string =>
  val || val === 0 ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val) : '';

const data = (val?: string | null): string => (val ? formatLocalDate(val) : '');

const enderecoCompleto = (partes: Array<string | undefined | null | false>): string =>
  partes.filter(Boolean).join(', ');

export function resolverVariaveisEmpresa(emp: Empresa): Record<string, string> {
  return {
    '{{empresa_nome}}': emp.nome_fantasia || emp.razao_social || '',
    '{{empresa_razao_social}}': emp.razao_social || emp.nome_fantasia || '',
    '{{empresa_cnpj}}': emp.cnpj || '',
    '{{empresa_endereco}}': emp.endereco || '',
    '{{empresa_telefone}}': emp.telefone || '',
    '{{empresa_email}}': emp.email || '',
    '{{empresa_chave_pix}}': emp.chave_pix || '',
  };
}

export function resolverVariaveisAssociado(assoc: Associado): Record<string, string> {
  const endereco = enderecoCompleto([
    assoc.endereco_logradouro || assoc.logradouro,
    (assoc.endereco_numero || assoc.numero) ? `nº ${assoc.endereco_numero || assoc.numero}` : '',
    assoc.endereco_bairro || assoc.bairro,
    assoc.endereco_cidade || assoc.cidade,
    (assoc.endereco_cep || assoc.cep) ? `CEP: ${assoc.endereco_cep || assoc.cep}` : '',
  ]);

  return {
    '{{associado_nome}}': assoc.nome || '',
    '{{associado_cpf}}': assoc.cpf || '',
    '{{associado_rg}}': assoc.rg || '',
    '{{associado_data_nasc}}': data(assoc.data_nascimento),
    '{{associado_sexo}}': assoc.sexo || '',
    '{{associado_nome_pai}}': assoc.nome_pai || '',
    '{{associado_nome_mae}}': assoc.nome_mae || '',
    '{{associado_telefone}}': assoc.telefone || '',
    '{{associado_email}}': assoc.email || '',
    '{{associado_endereco}}': endereco,
    '{{associado_logradouro}}': assoc.endereco_logradouro || assoc.logradouro || '',
    '{{associado_numero}}': assoc.endereco_numero || assoc.numero || '',
    '{{associado_bairro}}': assoc.endereco_bairro || assoc.bairro || '',
    '{{associado_cidade}}': assoc.endereco_cidade || assoc.cidade || '',
    '{{associado_estado}}': assoc.endereco_estado || assoc.uf || '',
    '{{associado_cep}}': assoc.endereco_cep || assoc.cep || '',
    '{{associado_status}}': (assoc.status || '').toUpperCase(),
    '{{associado_estado_civil}}': assoc.estado_civil || '',
    '{{associado_profissao}}': assoc.profissao || '',
    '{{associado_observacoes}}': assoc.observacoes || '',
    '{{plano_atual}}': assoc.plano_nome || '',
    '{{plano_nome}}': assoc.plano_nome || '',
    '{{numero_contrato}}': assoc.numero_contrato || `CTR-${assoc.id.substring(0, 8).toUpperCase()}`,
    '{{valor_mensalidade}}': formatBRL(assoc.valor_plano),
    '{{quantidade_dependentes}}': (assoc.dependentes?.length || 0).toString(),
    '{{data_adesao}}': data(assoc.data_adesao),
    '{{associado_dependentes}}':
      assoc.dependentes && assoc.dependentes.length > 0
        ? assoc.dependentes.map((d) => `${d.nome} (${d.parentesco || 'Dependente'} - CPF: ${d.cpf || 'Não inf.'})`).join('<br/>')
        : 'Nenhum dependente vinculado',
  };
}

/** Variáveis de um único dependente, selecionado à parte (não a lista consolidada de {{associado_dependentes}}). */
export function resolverVariaveisDependente(dep: Dependente): Record<string, string> {
  return {
    '{{dependente_nome}}': dep.nome || '',
    '{{dependente_cpf}}': dep.cpf || '',
    '{{dependente_data_nasc}}': data(dep.data_nascimento),
    '{{dependente_parentesco}}': dep.parentesco || '',
  };
}

/**
 * "Contrato" hoje é um espelho dos dados do Associado (ver src/types/contrato.ts) —
 * resolvido diretamente a partir do associado selecionado, sem entidade/seletor próprios.
 */
export function resolverVariaveisContrato(assoc: Associado): Record<string, string> {
  return {
    '{{contrato_numero}}': assoc.numero_contrato || `CTR-${assoc.id.substring(0, 8).toUpperCase()}`,
    '{{contrato_data_inicio}}': data(assoc.data_adesao),
    '{{contrato_valor_mensalidade}}': formatBRL(assoc.valor_plano),
    '{{contrato_status}}': (assoc.status || '').toUpperCase(),
  };
}

/** Variante quando já se tem um registro `Contrato` carregado diretamente da tabela `contratos`. */
export function resolverVariaveisContratoRegistro(contrato: Contrato): Record<string, string> {
  return {
    '{{contrato_numero}}': contrato.numero_contrato || '',
    '{{contrato_data_inicio}}': data(contrato.data_inicio),
    '{{contrato_valor_mensalidade}}': formatBRL(contrato.valor_mensalidade),
    '{{contrato_status}}': (contrato.status || '').toUpperCase(),
  };
}

export function resolverVariaveisAtendimento(atd: Atendimento): Record<string, string> {
  return {
    '{{atendimento_id}}': atd.id || '',
    '{{falecido_nome}}': atd.falecido_nome || '',
    '{{atendimento_falecido_nome}}': atd.falecido_nome || '',
    '{{falecido_cpf}}': atd.falecido_cpf || '',
    '{{atendimento_falecido_cpf}}': atd.falecido_cpf || '',
    '{{falecido_data_nascimento}}': data(atd.falecido_data_nascimento),
    '{{atendimento_falecido_data_nascimento}}': data(atd.falecido_data_nascimento),
    '{{datanasc_falecido}}': data(atd.falecido_data_nascimento),
    '{{data_obito}}': data(atd.data_obito),
    '{{atendimento_data_obito}}': data(atd.data_obito),
    '{{hora_obito}}': atd.hora_obito || '',
    '{{local_obito}}': atd.local_obito || '',
    '{{local_velorio}}': atd.local_velorio || '',
    '{{atendimento_local_velorio}}': atd.local_velorio || '',
    '{{local_sepultamento}}': atd.local_sepultamento || '',
    '{{atendimento_local_sepultamento}}': atd.local_sepultamento || '',
    '{{data_velorio}}': data(atd.data_velorio),
    '{{atendimento_data_velorio}}': data(atd.data_velorio),
    '{{data_sepultamento}}': data(atd.data_sepultamento),
    '{{atendimento_data_sepultamento}}': data(atd.data_sepultamento),
    '{{atendimento_valor}}': formatBRL(atd.valor_total) || 'R$ 0,00',
    '{{atendimento_valor_total}}': formatBRL(atd.valor_total) || 'R$ 0,00',
    '{{atendimento_status}}': (atd.status || '').toUpperCase(),
    '{{atendimento_tipo}}': atd.tipo_cliente === 'associado' ? 'Associado' : 'Cliente Externo',
    '{{cor_falecido}}': atd.cor_falecido || atd.etnia || '',
    '{{sexo_falecido}}': atd.sexo_falecido || atd.sexo || '',
    '{{declaracaoobito}}': atd.declaracao_obito || atd.numero_do || '',
    '{{declaracao_obito}}': atd.declaracao_obito || atd.numero_do || '',
    '{{medico_resp}}': atd.medico_responsavel || atd.medico_resp || '',
    '{{medico_responsavel}}': atd.medico_responsavel || atd.medico_resp || '',
    '{{crm_medico}}': atd.crm_medico || '',
    '{{rqe_medico}}': atd.rqe_medico || '',
    '{{inicio_tanato}}': atd.inicio_tanato || '',
    '{{termino_tanato}}': atd.termino_tanato || '',
    '{{atendimento_itens_lista}}':
      atd.itens && atd.itens.length > 0
        ? atd.itens.map((i) => `${i.quantidade}x ${i.item_nome || 'Item'} (${formatBRL(i.valor_unitario * i.quantidade)})`).join(', ')
        : 'Nenhum item adicionado',
  };
}

/** Lista consolidada de parcelas financeiras vinculadas a um atendimento. */
export function resolverVariaveisAtendimentoParcelas(parcelas: ParcelaReceber[]): Record<string, string> {
  return {
    '{{atendimento_parcelas_lista}}':
      parcelas.length > 0
        ? parcelas
            .map((p) => `Parcela ${p.numero_parcela} - Vencimento: ${data(p.data_vencimento)} - Valor: ${formatBRL(p.valor)} - Status: ${(p.status || '').toUpperCase()}`)
            .join('<br/>')
        : 'Nenhuma parcela financeira',
  };
}

export function resolverVariaveisPlano(plano: PlanoPax): Record<string, string> {
  return {
    '{{plano_nome}}': plano.nome || '',
    '{{plano_atual}}': plano.nome || '',
    '{{plano_codigo}}': plano.codigo || '',
    '{{plano_tipo}}': plano.tipo_plano === 'individual' ? 'Individual' : 'Coletivo / Familiar',
    '{{valor_mensalidade}}': formatBRL(plano.valor_mensalidade) || 'R$ 0,00',
    '{{plano_taxa_adesao}}': formatBRL(plano.taxa_adesao) || 'R$ 0,00',
    '{{plano_carencia}}': `${plano.carencia_geral_dias || 0} dias`,
    '{{plano_carencia_geral}}': `${plano.carencia_geral_dias || 0} dias`,
    '{{plano_carencia_acidente}}': `${plano.carencia_acidente_dias || 0} dias`,
    '{{plano_carencia_morte_natural}}': `${plano.carencia_morte_natural_dias || 0} dias`,
    '{{plano_limite_vidas}}': plano.limite_vidas ? String(plano.limite_vidas) : 'Ilimitado',
    '{{plano_vigencia_inicio}}': data(plano.vigencia_inicio),
    '{{plano_vigencia_fim}}': data(plano.vigencia_fim),
  };
}

export function resolverVariaveisCredenciado(cred: Credenciado): Record<string, string> {
  const endereco = enderecoCompleto([
    cred.endereco || cred.logradouro,
    cred.numero ? `nº ${cred.numero}` : '',
    cred.complemento,
    cred.bairro,
    cred.cidade,
    cred.estado || cred.uf,
    cred.cep ? `CEP: ${cred.cep}` : '',
  ]);

  return {
    '{{credenciado_nome}}': cred.razao_social || cred.nome_fantasia || '',
    '{{credenciado_fantasia}}': cred.nome_fantasia || cred.razao_social || '',
    '{{credenciado_cnpj}}': cred.cnpj_cpf || '',
    '{{credenciado_endereco}}': endereco,
    '{{credenciado_cidade}}': cred.cidade ? `${cred.cidade}${cred.estado || cred.uf ? ' - ' + (cred.estado || cred.uf) : ''}` : '',
    '{{credenciado_telefone}}': cred.telefone || '',
    '{{credenciado_email}}': cred.email || '',
    '{{credenciado_responsavel}}': cred.responsavel_nome || '',
    '{{credenciado_ramo}}': cred.ramo_atividade || '',
    '{{credenciado_registro_profissional}}': cred.registro_profissional || '',
    '{{credenciado_chave_pix}}': cred.chave_pix || '',
  };
}

export function resolverVariaveisFornecedor(forn: Fornecedor): Record<string, string> {
  const endereco = enderecoCompleto([
    forn.logradouro,
    forn.numero ? `nº ${forn.numero}` : '',
    forn.complemento,
    forn.bairro,
    forn.cidade,
    forn.uf,
    forn.cep ? `CEP: ${forn.cep}` : '',
  ]);

  return {
    '{{fornecedor_nome}}': forn.razao_social || forn.nome_fantasia || '',
    '{{fornecedor_fantasia}}': forn.nome_fantasia || forn.razao_social || '',
    '{{fornecedor_cnpj}}': forn.cnpj_cpf || '',
    '{{fornecedor_endereco}}': endereco,
    '{{fornecedor_cidade}}': forn.cidade ? `${forn.cidade}${forn.uf ? ' - ' + forn.uf : ''}` : '',
    '{{fornecedor_telefone}}': forn.telefone || forn.celular_whatsapp || '',
    '{{fornecedor_email}}': forn.email || '',
    '{{fornecedor_contato}}': forn.contato_nome || '',
    '{{fornecedor_chave_pix}}': forn.dados_bancarios?.chave_pix || '',
  };
}

export function resolverVariaveisUsuario(user: Usuario): Record<string, string> {
  const NIVEL_LABELS: Record<string, string> = {
    super_admin: 'Super Administrador',
    admin: 'Administrador',
    gerente: 'Gerente',
    funcionario: 'Funcionário',
  };
  return {
    '{{usuario_nome}}': user.nome || '',
    '{{usuario_email}}': user.email || '',
    '{{usuario_nivel}}': NIVEL_LABELS[user.nivel] || user.nivel || '',
  };
}

export function resolverVariaveisReceita(receita: Receita): Record<string, string> {
  return {
    '{{receita_descricao}}': receita.descricao || '',
    '{{receita_categoria}}': receita.categoria || '',
    '{{receita_data_emissao}}': data(receita.data_emissao),
    '{{receita_valor_total}}': formatBRL(receita.valor_total) || 'R$ 0,00',
    '{{receita_qtd_parcelas}}': String(receita.qtd_parcelas ?? ''),
    '{{receita_status}}': (receita.status || '').toUpperCase(),
    '{{forma_pagamento}}': receita.forma_pagamento_padrao || '',
    '{{devedor_nome}}': receita.associado_nome || receita.cliente_nome || '',
    '{{devedor_cpf_cnpj}}': receita.associado_cpf || receita.cliente_cpf_cnpj || '',
  };
}

export function resolverVariaveisParcelaReceber(parcela: ParcelaReceber): Record<string, string> {
  return {
    '{{parcela_numero}}': String(parcela.numero_parcela ?? ''),
    '{{parcela_valor}}': formatBRL(parcela.valor) || 'R$ 0,00',
    '{{parcela_vencimento}}': data(parcela.data_vencimento),
    '{{parcela_pagamento}}': data(parcela.data_pagamento),
    '{{parcela_status}}': (parcela.status || '').toUpperCase(),
    '{{forma_pagamento}}': parcela.forma_pagamento || '',
    '{{devedor_nome}}': parcela.devedor_nome || '',
    '{{devedor_cpf_cnpj}}': parcela.devedor_cpf_cnpj || '',
  };
}

export function resolverVariaveisDespesa(despesa: Despesa): Record<string, string> {
  return {
    '{{despesa_descricao}}': despesa.descricao || '',
    '{{despesa_categoria}}': despesa.categoria || '',
    '{{despesa_data_emissao}}': data(despesa.data_emissao),
    '{{despesa_valor_total}}': formatBRL(despesa.valor_total) || 'R$ 0,00',
    '{{despesa_status}}': (despesa.status || '').toUpperCase(),
    '{{credor_nome}}': despesa.fornecedor_nome || despesa.credor_nome || despesa.funcionario_nome || '',
    '{{credor_cpf_cnpj}}': despesa.fornecedor_cnpj_cpf || despesa.credor_cpf_cnpj || '',
  };
}

export function resolverVariaveisParcelaPagar(parcela: ParcelaPagar): Record<string, string> {
  return {
    '{{parcela_numero}}': String(parcela.numero_parcela ?? ''),
    '{{parcela_valor}}': formatBRL(parcela.valor) || 'R$ 0,00',
    '{{parcela_vencimento}}': data(parcela.data_vencimento),
    '{{parcela_pagamento}}': data(parcela.data_pagamento),
    '{{parcela_status}}': (parcela.status || '').toUpperCase(),
    '{{forma_pagamento}}': parcela.forma_pagamento || '',
    '{{credor_nome}}': parcela.credor_nome || '',
    '{{credor_cpf_cnpj}}': parcela.credor_cpf_cnpj || '',
  };
}

export function resolverVariaveisRequisicao(req: Requisicao): Record<string, string> {
  const itensLista =
    req.itens && req.itens.length > 0
      ? req.itens.map((i) => `${i.quantidade}x ${i.descricao} (${formatBRL(i.valor_total)})`).join('<br/>')
      : 'Nenhum item';

  return {
    '{{requisicao_codigo}}': req.codigo_requisicao || '',
    '{{requisicao_data_emissao}}': data(req.data_emissao),
    '{{requisicao_data_validade}}': data(req.data_validade),
    '{{requisicao_paciente_nome}}': req.paciente_nome || '',
    '{{requisicao_paciente_cpf}}': req.paciente_cpf || '',
    '{{requisicao_credenciado_nome}}': req.credenciado_nome || '',
    '{{requisicao_medico_solicitante}}': req.medico_solicitante || '',
    '{{requisicao_crm_solicitante}}': req.crm_solicitante || '',
    '{{requisicao_itens_lista}}': itensLista,
    '{{requisicao_valor_total}}': formatBRL(req.valor_total) || 'R$ 0,00',
    '{{requisicao_status}}': (req.status || '').toUpperCase(),
  };
}

/** Data/hora do sistema no momento da geração do documento. */
export function resolverVariaveisSistema(agora: Date = new Date()): Record<string, string> {
  return {
    '{{data_atual}}': formatLocalDate(agora),
    '{{hora_atual}}': agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    '{{data_hora_atual}}': `${formatLocalDate(agora)} às ${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
    '{{mes_atual}}': agora.toLocaleDateString('pt-BR', { month: 'long' }),
    '{{ano_atual}}': agora.getFullYear().toString(),
  };
}
