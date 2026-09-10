/**
 * Preenchimento dos dados do responsável pelo falecido a partir do cadastro do associado.
 *
 * Função pura, do mesmo desenho da Ficha de Cadastro e da Demonstração Contábil: aqui se
 * decide **o quê** preencher, e cada tela decide só **como** exibir. É o que torna a regra
 * testável sem navegador — e ela tem um caso-limite que só aparece escrito.
 */
import { Associado } from '../services/associadosService';

export interface DadosResponsavel {
  responsavel_nome: string;
  responsavel_cpf: string;
  responsavel_rg: string;
  responsavel_parentesco: string;
  responsavel_endereco: string;
  responsavel_contato: string;
  responsavel_nacionalidade: string;
  responsavel_observacoes: string;
}

export const RESPONSAVEL_VAZIO: DadosResponsavel = {
  responsavel_nome: '',
  responsavel_cpf: '',
  responsavel_rg: '',
  responsavel_parentesco: '',
  responsavel_endereco: '',
  responsavel_contato: '',
  responsavel_nacionalidade: '',
  responsavel_observacoes: '',
};

/** Vínculo preenchido quando quem responde é o próprio titular do plano. */
export const PARENTESCO_TITULAR = 'TITULAR DO PLANO';

/**
 * Endereço do associado em uma linha.
 *
 * Lê pelo par canônico com fallback no legado (`endereco_logradouro || logradouro`), que é
 * o padrão documentado no CLAUDE.md — e vale lembrar que desde a PR #30 o legado é uma
 * fotografia, não um alias: se o canônico existir, é ele que vale, nunca o outro.
 */
export function enderecoDoAssociado(assoc: Partial<Associado>): string {
  const numero = assoc.endereco_numero || assoc.numero;
  const cep = assoc.endereco_cep || assoc.cep;
  const cidade = assoc.endereco_cidade || assoc.cidade || assoc.municipio;
  const uf = assoc.endereco_estado || assoc.uf;

  return [
    assoc.endereco_logradouro || assoc.logradouro,
    numero ? `nº ${numero}` : '',
    assoc.endereco_bairro || assoc.bairro,
    cidade && uf ? `${cidade} - ${uf}` : cidade || uf,
    cep ? `CEP: ${cep}` : '',
  ]
    .filter(Boolean)
    .join(', ');
}

/**
 * Contato do associado, na ordem em que a funerária de fato liga: celular/WhatsApp,
 * telefone fixo, e-mail. Um só — a tela tem um campo, não três.
 */
export function contatoDoAssociado(assoc: Partial<Associado>): string {
  return assoc.celular_whatsapp || assoc.telefone || assoc.email || '';
}

/**
 * Dados do responsável derivados do associado do atendimento.
 *
 * **O titular não pode ser responsável por si mesmo.** Quando o falecido é o próprio
 * titular, preencher o bloco com o cadastro dele produziria um documento afirmando que o
 * morto assinou como responsável pelo próprio velório — errado, e errado em silêncio,
 * porque todos os campos apareceriam preenchidos e ninguém teria motivo para conferir.
 * Nesse caso devolvemos tudo em branco: a tela pede que o operador informe quem responde.
 * Só quando o falecido é um **dependente** o titular é, por construção, quem responde.
 *
 * `responsavel_nacionalidade` nunca vem preenchida: não existe coluna de nacionalidade em
 * `associados`. Inventar "BRASILEIRA" seria escrever no documento um dado que ninguém
 * afirmou.
 */
export function dadosResponsavelDoAssociado(params: {
  associado?: Partial<Associado> | null;
  /** `true` quando quem morreu é o próprio titular do plano. */
  falecidoEhTitular: boolean;
}): DadosResponsavel {
  const { associado, falecidoEhTitular } = params;
  if (!associado || falecidoEhTitular) return { ...RESPONSAVEL_VAZIO };

  return {
    ...RESPONSAVEL_VAZIO,
    responsavel_nome: (associado.nome || '').trim().toUpperCase(),
    responsavel_cpf: associado.cpf || '',
    responsavel_rg: associado.rg || '',
    responsavel_parentesco: PARENTESCO_TITULAR,
    responsavel_endereco: enderecoDoAssociado(associado),
    responsavel_contato: contatoDoAssociado(associado),
  };
}

/**
 * Normaliza o bloco para gravação: campo em branco vira `null`, não `''` nem `undefined`.
 *
 * `''` está fora porque vazio é ausência e ausência se escreve `NULL` (a lição de
 * `credenciados.cnpj_cpf` no CLAUDE.md). E `undefined` está fora por um motivo que só
 * aparece no caminho de **edição**: `JSON.stringify` descarta a chave, então o `upsert`
 * chegaria ao Postgres sem a coluna e o valor antigo continuaria lá — apagar um campo na
 * tela não apagaria nada no banco, em silêncio. `null` é o que de fato limpa a coluna, e
 * no insert equivale a omitir.
 */
export function responsavelParaGravacao(
  dados: DadosResponsavel,
): Record<keyof DadosResponsavel, string | null> {
  const limpo = (v: string) => v.trim() || null;
  const limpoMaiusculo = (v: string) => v.trim().toUpperCase() || null;
  return {
    responsavel_nome: limpoMaiusculo(dados.responsavel_nome),
    responsavel_cpf: limpo(dados.responsavel_cpf),
    responsavel_rg: limpo(dados.responsavel_rg),
    responsavel_parentesco: limpoMaiusculo(dados.responsavel_parentesco),
    responsavel_endereco: limpo(dados.responsavel_endereco),
    responsavel_contato: limpo(dados.responsavel_contato),
    responsavel_nacionalidade: limpoMaiusculo(dados.responsavel_nacionalidade),
    responsavel_observacoes: limpo(dados.responsavel_observacoes),
  };
}
