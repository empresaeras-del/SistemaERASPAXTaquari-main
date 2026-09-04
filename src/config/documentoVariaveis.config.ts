/**
 * Catálogo de variáveis {{...}} dos Documentos Padrões, por módulo — fonte única.
 *
 * Usado pelo painel lateral de inserção de variáveis (editor de modelos) para listar,
 * pesquisar e inserir tags no conteúdo. As tags aqui declaradas devem corresponder
 * exatamente às chaves resolvidas em `src/utils/documentoVariaveis.ts` — divergência
 * entre os dois faz a tag aparecer no catálogo mas nunca ser preenchida na pré-visualização.
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

export const MODULOS_VARIAVEIS: ModuloInfo[] = [
  {
    id: 'associado', label: 'Associado', icon: '👤', cor: '#3B82F6',
    variaveis: [
      { variavel: '{{associado_nome}}',       label: 'Nome completo',      descricao: 'Nome completo do associado' },
      { variavel: '{{associado_cpf}}',        label: 'CPF',                descricao: 'CPF do associado (formatado)' },
      { variavel: '{{associado_rg}}',         label: 'RG',                 descricao: 'Registro Geral do associado' },
      { variavel: '{{associado_data_nasc}}',  label: 'Data de nascimento', descricao: 'Data de nascimento do associado' },
      { variavel: '{{associado_sexo}}',       label: 'Sexo',               descricao: 'Sexo do associado' },
      { variavel: '{{associado_nome_pai}}',   label: 'Nome do pai',        descricao: 'Nome do pai do associado' },
      { variavel: '{{associado_nome_mae}}',   label: 'Nome da mãe',        descricao: 'Nome da mãe do associado' },
      { variavel: '{{associado_telefone}}',   label: 'Telefone',           descricao: 'Telefone do associado' },
      { variavel: '{{associado_email}}',      label: 'E-mail',             descricao: 'E-mail do associado' },
      { variavel: '{{associado_endereco}}',   label: 'Endereço completo',  descricao: 'Logradouro, número, bairro e cidade' },
      { variavel: '{{associado_logradouro}}', label: 'Logradouro',         descricao: 'Rua/Avenida do associado' },
      { variavel: '{{associado_numero}}',     label: 'Número',             descricao: 'Número do endereço' },
      { variavel: '{{associado_bairro}}',     label: 'Bairro',             descricao: 'Bairro do associado' },
      { variavel: '{{associado_cidade}}',     label: 'Cidade',             descricao: 'Cidade do associado' },
      { variavel: '{{associado_estado}}',     label: 'Estado (UF)',        descricao: 'Estado do associado' },
      { variavel: '{{associado_cep}}',        label: 'CEP',                descricao: 'CEP do associado' },
      { variavel: '{{associado_status}}',     label: 'Status',             descricao: 'Status do associado (ativo, inativo...)' },
      { variavel: '{{associado_estado_civil}}', label: 'Estado civil',     descricao: 'Estado civil do associado' },
      { variavel: '{{associado_profissao}}',  label: 'Profissão',          descricao: 'Profissão do associado' },
      { variavel: '{{associado_observacoes}}', label: 'Observações',       descricao: 'Observações cadastrais do associado' },
    ]
  },
  {
    id: 'dependentes', label: 'Dependentes', icon: '👨‍👩‍👧', cor: '#8B5CF6',
    variaveis: [
      { variavel: '{{associado_dependentes}}',   label: 'Lista de dependentes',  descricao: 'Nome, parentesco e CPF de cada dependente' },
      { variavel: '{{quantidade_dependentes}}',  label: 'Qtd. de dependentes',   descricao: 'Número total de dependentes vinculados' },
      { variavel: '{{dependente_nome}}',         label: 'Nome do dependente',    descricao: 'Nome do dependente selecionado individualmente' },
      { variavel: '{{dependente_cpf}}',          label: 'CPF do dependente',     descricao: 'CPF do dependente selecionado' },
      { variavel: '{{dependente_data_nasc}}',    label: 'Data nasc. do dependente', descricao: 'Data de nascimento do dependente selecionado' },
      { variavel: '{{dependente_parentesco}}',   label: 'Parentesco',            descricao: 'Grau de parentesco do dependente selecionado' },
    ]
  },
  {
    id: 'contrato', label: 'Contrato', icon: '📄', cor: '#0EA5E9',
    variaveis: [
      { variavel: '{{contrato_numero}}',             label: 'Nº do contrato',        descricao: 'Número do contrato do associado' },
      { variavel: '{{contrato_data_inicio}}',        label: 'Data de início',        descricao: 'Data de início / adesão ao contrato' },
      { variavel: '{{contrato_valor_mensalidade}}',  label: 'Valor da mensalidade',  descricao: 'Valor mensal do contrato, formatado em R$' },
      { variavel: '{{contrato_status}}',             label: 'Status do contrato',    descricao: 'Situação do contrato (ativo, inadimplente...)' },
      { variavel: '{{numero_contrato}}',             label: 'Nº do contrato (alias)',descricao: 'Tag alternativa para o número do contrato' },
      { variavel: '{{data_adesao}}',                 label: 'Data de adesão (alias)',descricao: 'Tag alternativa para a data de adesão' },
    ]
  },
  {
    id: 'plano', label: 'Plano PAX', icon: '💳', cor: '#10B981',
    variaveis: [
      { variavel: '{{plano_nome}}',             label: 'Nome do plano',        descricao: 'Nome do plano contratado' },
      { variavel: '{{plano_atual}}',            label: 'Plano atual (alias)',  descricao: 'Tag alternativa para o nome do plano' },
      { variavel: '{{plano_codigo}}',           label: 'Código do plano',      descricao: 'Código identificador do plano' },
      { variavel: '{{plano_tipo}}',             label: 'Tipo do plano',        descricao: 'Individual ou Coletivo/Familiar' },
      { variavel: '{{valor_mensalidade}}',      label: 'Valor da mensalidade', descricao: 'Valor mensal formatado em R$' },
      { variavel: '{{plano_taxa_adesao}}',      label: 'Taxa de adesão',       descricao: 'Valor da taxa de adesão ao plano' },
      { variavel: '{{plano_carencia}}',         label: 'Carência geral',       descricao: 'Dias de carência geral do plano' },
      { variavel: '{{plano_carencia_geral}}',   label: 'Carência geral (alias)', descricao: 'Tag alternativa para carência geral' },
      { variavel: '{{plano_carencia_acidente}}', label: 'Carência p/ acidente', descricao: 'Dias de carência para morte acidental' },
      { variavel: '{{plano_carencia_morte_natural}}', label: 'Carência p/ morte natural', descricao: 'Dias de carência para morte natural' },
      { variavel: '{{plano_limite_vidas}}',     label: 'Limite de vidas',      descricao: 'Número máximo de vidas no plano' },
      { variavel: '{{plano_vigencia_inicio}}',  label: 'Vigência início',      descricao: 'Data de início de vigência do plano' },
      { variavel: '{{plano_vigencia_fim}}',     label: 'Vigência fim',         descricao: 'Data de fim de vigência do plano' },
    ]
  },
  {
    id: 'empresa', label: 'Empresa Emissora', icon: '🏢', cor: '#F59E0B',
    variaveis: [
      { variavel: '{{empresa_nome}}',         label: 'Nome da empresa',  descricao: 'Nome fantasia da empresa emissora' },
      { variavel: '{{empresa_razao_social}}', label: 'Razão social',     descricao: 'Razão social da empresa emissora' },
      { variavel: '{{empresa_cnpj}}',         label: 'CNPJ',             descricao: 'CNPJ da empresa emissora' },
      { variavel: '{{empresa_endereco}}',     label: 'Endereço',         descricao: 'Endereço da empresa emissora' },
      { variavel: '{{empresa_telefone}}',     label: 'Telefone',         descricao: 'Telefone da empresa emissora' },
      { variavel: '{{empresa_email}}',        label: 'E-mail',           descricao: 'E-mail da empresa emissora' },
      { variavel: '{{empresa_chave_pix}}',    label: 'Chave PIX',        descricao: 'Chave PIX da empresa emissora' },
    ]
  },
  {
    id: 'usuario', label: 'Usuário Logado', icon: '🖊️', cor: '#A855F7',
    variaveis: [
      { variavel: '{{usuario_nome}}',  label: 'Nome do usuário',  descricao: 'Nome do usuário logado que está emitindo o documento' },
      { variavel: '{{usuario_email}}', label: 'E-mail do usuário', descricao: 'E-mail do usuário logado' },
      { variavel: '{{usuario_nivel}}', label: 'Nível de acesso',  descricao: 'Perfil/nível de acesso do usuário logado' },
    ]
  },
  {
    id: 'credenciado', label: 'Credenciado', icon: '🏥', cor: '#EF4444',
    variaveis: [
      { variavel: '{{credenciado_nome}}',        label: 'Nome/Razão social',  descricao: 'Razão social do credenciado' },
      { variavel: '{{credenciado_fantasia}}',    label: 'Nome fantasia',      descricao: 'Nome fantasia do credenciado' },
      { variavel: '{{credenciado_cnpj}}',        label: 'CNPJ/CPF',           descricao: 'CNPJ ou CPF do credenciado' },
      { variavel: '{{credenciado_endereco}}',    label: 'Endereço',           descricao: 'Endereço completo do credenciado' },
      { variavel: '{{credenciado_cidade}}',      label: 'Cidade',             descricao: 'Cidade do credenciado' },
      { variavel: '{{credenciado_telefone}}',    label: 'Telefone',           descricao: 'Telefone do credenciado' },
      { variavel: '{{credenciado_email}}',       label: 'E-mail',             descricao: 'E-mail do credenciado' },
      { variavel: '{{credenciado_responsavel}}', label: 'Responsável',        descricao: 'Nome do responsável técnico' },
      { variavel: '{{credenciado_ramo}}',        label: 'Ramo de atividade',  descricao: 'Ramo de atividade do credenciado' },
      { variavel: '{{credenciado_registro_profissional}}', label: 'Registro profissional', descricao: 'Registro profissional do credenciado' },
      { variavel: '{{credenciado_chave_pix}}',   label: 'Chave PIX',          descricao: 'Chave PIX do credenciado' },
    ]
  },
  {
    id: 'atendimento', label: 'Atendimento / Óbito', icon: '🕯️', cor: '#64748B',
    variaveis: [
      { variavel: '{{falecido_nome}}',            label: 'Nome do falecido',      descricao: 'Nome do falecido registrado no atendimento' },
      { variavel: '{{falecido_cpf}}',             label: 'CPF do falecido',       descricao: 'CPF do falecido' },
      { variavel: '{{falecido_data_nascimento}}', label: 'Data nascimento (falecido)', descricao: 'Data de nascimento do falecido' },
      { variavel: '{{datanasc_falecido}}',        label: 'Data nasc. (alias)',    descricao: 'Tag alternativa para data de nascimento' },
      { variavel: '{{cor_falecido}}',             label: 'Cor / Raça',            descricao: 'Cor ou etnia do falecido' },
      { variavel: '{{sexo_falecido}}',            label: 'Sexo do falecido',      descricao: 'Sexo do falecido' },
      { variavel: '{{data_obito}}',               label: 'Data do óbito',         descricao: 'Data do falecimento' },
      { variavel: '{{hora_obito}}',               label: 'Hora do óbito',         descricao: 'Horário do falecimento' },
      { variavel: '{{local_obito}}',              label: 'Local do óbito',        descricao: 'Local onde ocorreu o óbito' },
      { variavel: '{{declaracao_obito}}',         label: 'Nº da Declaração Óbito',descricao: 'Número da certidão / declaração de óbito' },
      { variavel: '{{medico_resp}}',              label: 'Médico responsável',    descricao: 'Nome do médico que atestou' },
      { variavel: '{{crm_medico}}',               label: 'CRM do Médico',         descricao: 'CRM do médico responsável' },
      { variavel: '{{rqe_medico}}',               label: 'RQE do Médico',         descricao: 'RQE do médico responsável' },
      { variavel: '{{local_velorio}}',            label: 'Local do velório',      descricao: 'Local onde será o velório' },
      { variavel: '{{local_sepultamento}}',       label: 'Local de sepultamento', descricao: 'Cemitério / Local de sepultamento' },
      { variavel: '{{data_velorio}}',             label: 'Data do velório',       descricao: 'Data do velório' },
      { variavel: '{{data_sepultamento}}',        label: 'Data do sepultamento',  descricao: 'Data do sepultamento' },
      { variavel: '{{inicio_tanato}}',            label: 'Início Tanatopraxia',   descricao: 'Horário de início da tanatopraxia' },
      { variavel: '{{termino_tanato}}',           label: 'Término Tanatopraxia',  descricao: 'Horário de término da tanatopraxia' },
      { variavel: '{{atendimento_valor}}',        label: 'Valor total',           descricao: 'Valor total do atendimento funerário' },
      { variavel: '{{atendimento_status}}',       label: 'Status',                descricao: 'Status do atendimento (aberto, concluído...)' },
      { variavel: '{{atendimento_tipo}}',         label: 'Tipo de cliente',       descricao: 'Associado ou Cliente Externo' },
      { variavel: '{{atendimento_itens_lista}}',  label: 'Itens do atendimento',  descricao: 'Lista dos itens/serviços incluídos no atendimento' },
      { variavel: '{{atendimento_parcelas_lista}}', label: 'Parcelas do atendimento', descricao: 'Lista das parcelas financeiras vinculadas ao atendimento' },
    ]
  },
  {
    id: 'requisicao', label: 'Requisição / Guia', icon: '📋', cor: '#06B6D4',
    variaveis: [
      { variavel: '{{requisicao_codigo}}',              label: 'Código da requisição', descricao: 'Código único (ex: REQ-2026-001)' },
      { variavel: '{{requisicao_data_emissao}}',        label: 'Data de emissão',      descricao: 'Data de emissão da requisição' },
      { variavel: '{{requisicao_data_validade}}',       label: 'Data de validade',     descricao: 'Data de validade da requisição' },
      { variavel: '{{requisicao_paciente_nome}}',       label: 'Nome do paciente',     descricao: 'Nome do paciente (titular ou dependente)' },
      { variavel: '{{requisicao_paciente_cpf}}',        label: 'CPF do paciente',      descricao: 'CPF do paciente' },
      { variavel: '{{requisicao_credenciado_nome}}',    label: 'Credenciado',          descricao: 'Nome do credenciado vinculado à requisição' },
      { variavel: '{{requisicao_medico_solicitante}}',  label: 'Médico solicitante',   descricao: 'Nome do médico solicitante' },
      { variavel: '{{requisicao_crm_solicitante}}',     label: 'CRM do médico',        descricao: 'CRM do médico solicitante' },
      { variavel: '{{requisicao_itens_lista}}',         label: 'Itens da requisição',  descricao: 'Lista dos itens/procedimentos solicitados' },
      { variavel: '{{requisicao_valor_total}}',         label: 'Valor total',          descricao: 'Valor total da requisição' },
      { variavel: '{{requisicao_status}}',              label: 'Status',               descricao: 'Situação da requisição' },
    ]
  },
  {
    id: 'financeiro', label: 'Financeiro / Pagamentos', icon: '💰', cor: '#22C55E',
    variaveis: [
      { variavel: '{{receita_descricao}}',    label: 'Descrição da receita', descricao: 'Descrição do lançamento de receita' },
      { variavel: '{{receita_categoria}}',    label: 'Categoria',            descricao: 'Categoria do lançamento financeiro' },
      { variavel: '{{receita_data_emissao}}', label: 'Data de emissão',      descricao: 'Data de emissão da receita' },
      { variavel: '{{receita_valor_total}}',  label: 'Valor total',          descricao: 'Valor total do lançamento' },
      { variavel: '{{receita_qtd_parcelas}}', label: 'Qtd. de parcelas',     descricao: 'Número de parcelas da receita' },
      { variavel: '{{receita_status}}',       label: 'Status da receita',    descricao: 'Situação do lançamento (pago, pendente...)' },
      { variavel: '{{parcela_numero}}',       label: 'Nº da parcela',        descricao: 'Número da parcela (ex: 1)' },
      { variavel: '{{parcela_valor}}',        label: 'Valor da parcela',     descricao: 'Valor da parcela formatado em R$' },
      { variavel: '{{parcela_vencimento}}',   label: 'Vencimento',           descricao: 'Data de vencimento da parcela' },
      { variavel: '{{parcela_pagamento}}',    label: 'Data de pagamento',    descricao: 'Data em que a parcela foi paga' },
      { variavel: '{{parcela_status}}',       label: 'Status da parcela',    descricao: 'Situação da parcela (pago, em aberto...)' },
      { variavel: '{{forma_pagamento}}',      label: 'Forma de pagamento',   descricao: 'Forma de pagamento (PIX, boleto...)' },
      { variavel: '{{devedor_nome}}',         label: 'Nome do devedor',      descricao: 'Nome do associado/cliente devedor' },
      { variavel: '{{devedor_cpf_cnpj}}',     label: 'CPF/CNPJ do devedor',  descricao: 'Documento do devedor' },
    ]
  },
  {
    id: 'fornecedor', label: 'Fornecedor', icon: '🚚', cor: '#F97316',
    variaveis: [
      { variavel: '{{fornecedor_nome}}',      label: 'Razão social',  descricao: 'Razão social do fornecedor' },
      { variavel: '{{fornecedor_fantasia}}',  label: 'Nome fantasia', descricao: 'Nome fantasia do fornecedor' },
      { variavel: '{{fornecedor_cnpj}}',      label: 'CNPJ/CPF',      descricao: 'CNPJ ou CPF do fornecedor' },
      { variavel: '{{fornecedor_endereco}}',  label: 'Endereço',      descricao: 'Endereço completo do fornecedor' },
      { variavel: '{{fornecedor_cidade}}',    label: 'Cidade',        descricao: 'Cidade do fornecedor' },
      { variavel: '{{fornecedor_telefone}}',  label: 'Telefone',      descricao: 'Telefone do fornecedor' },
      { variavel: '{{fornecedor_email}}',     label: 'E-mail',        descricao: 'E-mail do fornecedor' },
      { variavel: '{{fornecedor_contato}}',   label: 'Contato',       descricao: 'Nome do contato no fornecedor' },
      { variavel: '{{fornecedor_chave_pix}}', label: 'Chave PIX',     descricao: 'Chave PIX do fornecedor' },
    ]
  },
  {
    id: 'sistema', label: 'Sistema / Data', icon: '🖥️', cor: '#94A3B8',
    variaveis: [
      { variavel: '{{data_atual}}',      label: 'Data atual',        descricao: 'Data atual no momento da emissão' },
      { variavel: '{{hora_atual}}',      label: 'Hora atual',        descricao: 'Hora atual no momento da emissão' },
      { variavel: '{{data_hora_atual}}', label: 'Data e hora atual', descricao: 'Data e hora completas de emissão' },
      { variavel: '{{mes_atual}}',       label: 'Mês atual',         descricao: 'Nome do mês atual por extenso' },
      { variavel: '{{ano_atual}}',       label: 'Ano atual',         descricao: 'Ano atual (ex: 2026)' },
    ]
  },
];
