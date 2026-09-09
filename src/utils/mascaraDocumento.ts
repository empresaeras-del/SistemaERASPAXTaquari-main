/**
 * Máscara de CPF/CNPJ para saída impressa — relatórios de Contas a Receber, Contas a Pagar e
 * Auditoria.
 *
 * Um relatório sai da tela: vira PDF anexado em e-mail, papel em cima de uma mesa, arquivo
 * numa pasta compartilhada. É onde o documento de um associado deixa de estar protegido pela
 * RLS e pelo login. Por isso a máscara vale no relatório, não no cadastro — quem opera a tela
 * continua vendo o número inteiro, que é o que ele precisa para conferir e cobrar.
 *
 * ## O que fica escondido, e por quê
 *
 * - **CPF** `046.537.031-40` → `***.537.031-**` — some o prefixo e os **dígitos
 *   verificadores**.
 * - **CNPJ** `33.520.000/0001-71` → `**.***.000/0001-**` — mesma ideia.
 *
 * Esconder os verificadores é o ponto: são eles que permitem validar um palpite. Com o bloco
 * do meio visível, quem lê o relatório ainda distingue uma linha da outra e confere contra um
 * documento que já tem em mãos; quem só recebeu o arquivo não consegue reconstruir o número.
 *
 * ## O que **não** é mascarado, de propósito
 *
 * - **O CNPJ da própria empresa no cabeçalho.** É a identificação do emitente no próprio
 *   documento — mascarar tornaria o relatório inválido como comprovante, e o dado é público.
 * - **Qualquer valor que não seja um documento.** O campo `credor_cpf_cnpj` é texto livre e
 *   às vezes guarda um nome ("ASSESSORIA JURIDICA PAX"). Sem 11 ou 14 dígitos, o valor volta
 *   inteiro: mascarar às cegas embaralharia informação legítima.
 */

/** Só os dígitos, para decidir se é CPF, CNPJ ou nenhum dos dois. */
const apenasDigitos = (valor: string): string => (valor ?? '').replace(/\D/g, '');

/**
 * Mascara um CPF ou CNPJ, aceitando o valor formatado ou só os dígitos.
 *
 * Devolve o valor **inalterado** quando não é documento (nome, texto livre, vazio) — ver o
 * comentário do módulo. Nunca lança.
 */
export function mascararDocumento(valor: string | null | undefined): string {
  if (valor == null) return '';
  const original = String(valor);
  const digitos = apenasDigitos(original);

  if (digitos.length === 11) {
    // ***.537.031-**
    return `***.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-**`;
  }

  if (digitos.length === 14) {
    // **.***.000/0001-**
    return `**.***.${digitos.slice(5, 8)}/${digitos.slice(8, 12)}-**`;
  }

  return original;
}

/**
 * O nome do campo indica que ele guarda um CPF/CNPJ?
 *
 * Usado pelo diff da auditoria, onde os campos chegam genéricos (`dados_anteriores` /
 * `dados_novos` de qualquer tabela) e a decisão de mascarar precisa vir do nome. Compara sem
 * acento e sem caixa, e casa por trecho — pega `cpf`, `cnpj`, `cpf_cnpj`, `cnpj_cpf`,
 * `associado_cpf`, `fornecedor_cnpj_cpf`, `credor_cpf_cnpj`, `funcionario_cpf`.
 */
export function ehCampoDeDocumento(nomeCampo: string | null | undefined): boolean {
  const nome = (nomeCampo ?? '').toLowerCase();
  return nome.includes('cpf') || nome.includes('cnpj');
}

/**
 * Aplica a máscara a um valor de campo quando o **nome** do campo indica documento.
 *
 * Preserva o tipo do que recebe: só string vira string mascarada. Número, objeto, `null` e
 * `undefined` passam intactos — um `cpf` guardado como número no log continua sendo mostrado
 * como estava, em vez de virar `"[object Object]"` ou sumir. (Na prática o schema guarda CPF
 * como texto; isto é a rede de segurança para um log antigo fora do formato.)
 */
export function mascararValorDeCampo(nomeCampo: string, valor: unknown): unknown {
  if (typeof valor !== 'string') return valor;
  if (!ehCampoDeDocumento(nomeCampo)) return valor;
  return mascararDocumento(valor);
}
