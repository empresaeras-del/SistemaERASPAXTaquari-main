/**
 * Recusa do servidor: a classe que separa "o Postgres disse não" de "a rede caiu".
 *
 * Vive em `utils/` porque mais de um service precisa da mesma distinção — nasceu em
 * `associadosService` (substituindo o `resilientSupabaseUpsert`, que mutilava o payload até
 * o banco aceitar) e o `caixasService` passou a usá-la nos quatro caminhos de escrita de
 * caixa. Copiar a tradução para o segundo service faria as duas metades divergirem no
 * primeiro código de erro novo, que é a lição que este repositório já registra em outros
 * predicados duplicados.
 */

/**
 * Recusa do Postgres — distinta de uma queda de rede.
 *
 * O CLAUDE.md fixa que as duas **não podem terminar igual**: exceção lançada (rede fora) é o
 * caso offline-first legítimo e vai para o IndexedDB e para a fila de sync; `error` devolvido
 * pelo cliente é recusa (constraint, RLS, coluna inexistente) e repetir amanhã dá o mesmo
 * resultado, então enfileirar **só adia a perda**. Num `catch` só elas são indistinguíveis —
 * esta classe é o que permite ao chamador separá-las.
 */
export class RecusaDoServidor extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RecusaDoServidor';
  }
}

/**
 * Traduz a recusa do Postgres numa frase que diz o que fazer.
 *
 * O `error` do supabase-js chega com `message`, `details`, `hint` e `code`. Repassar só a
 * `message` deixa o operador com "insert or update on table violates foreign key
 * constraint", que não diz qual campo nem o que corrigir. Aqui o código vira a frase, e a
 * mensagem do servidor continua no fim — quem lê o `toast` decide, quem lê o log depura.
 */
export const explicarRecusa = (tableName: string, error: any): string => {
  const msg = error?.message || '';
  const detalhes = error?.details || '';
  const completo = `${msg} ${detalhes}`;

  const colunaAusente =
    completo.match(/Could not find the '([^']+)' column/i) ||
    completo.match(/column "([^"]+)" of relation/i) ||
    completo.match(/column "([^"]+)" does not exist/i);

  if (error?.code === 'PGRST204' || error?.code === '42703' || colunaAusente) {
    const coluna = colunaAusente?.[1] || 'desconhecida';
    return (
      `A coluna '${coluna}' não existe na tabela '${tableName}'. ` +
      'Isso é campo no TypeScript sem a migration correspondente — nada foi salvo. ' +
      `Detalhe do servidor: ${msg}`
    );
  }

  if (error?.code === '23503') {
    return (
      `A tabela '${tableName}' recusou uma referência que não existe (ou é de outra empresa). ` +
      'Confira o plano, a empresa ou o registro vinculado antes de salvar de novo. ' +
      `Detalhe do servidor: ${msg}`
    );
  }

  if (error?.code === '23502') {
    return `Campo obrigatório não preenchido em '${tableName}'. Detalhe do servidor: ${msg}`;
  }

  if (error?.code === '23514') {
    return (
      `Valor fora do domínio aceito pela tabela '${tableName}'. ` +
      `Detalhe do servidor: ${msg}`
    );
  }

  if (error?.code === '42501') {
    return `Sem permissão para gravar em '${tableName}'. Detalhe do servidor: ${msg}`;
  }

  return `Erro ao gravar em '${tableName}': ${msg || error}`;
};
