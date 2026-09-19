import { TipoFornecedor } from '../types/fornecedores';

/**
 * Tipos de fornecimento: um **domínio fechado de três valores**, não um catálogo.
 *
 * Até 18/09/2026 o formulário de fornecedor tinha um "Gerenciar" que deixava acrescentar um
 * valor novo à lista — e essa lista vivia no `localStorage` de cada navegador. Parece a mesma
 * doença das categorias (que viraram tabela na migration `20260918010924`), e **não é**: aqui
 * não há catálogo que a empresa precise manter. Os rótulos são cravados no código, o filtro da
 * listagem sempre ofereceu só estes três, e os cards de resumo contam `produtos`/`servicos`/
 * `ambos` explicitamente. Um quarto valor nasceria **sem rótulo, fora do filtro e fora dos
 * contadores** — visível só na coluna crua da tabela. A correção foi tirar a ação, não criar
 * tabela.
 *
 * O domínio passou a valer também no banco (`fornecedores_tipo_fornecedor_check`, migration
 * `20260918185138`): esconder o botão é conveniência, a recusa mora no ponto de escrita.
 *
 * **Ao acrescentar um valor aqui, acrescente o `CHECK` na mesma tarefa** — é a regra que este
 * projeto já registra para campo novo em interface persistida, na direção contrária.
 */

export interface OpcaoTipoFornecimento {
  /**
   * `string`, não `TipoFornecedor`, de propósito: a lista pode carregar um valor legado que está
   * gravado e não pertence mais ao domínio (ver `opcoesTipoFornecimento`). Tipar como
   * `TipoFornecedor` obrigaria um `as` que afirmaria o contrário do que se sabe.
   */
  valor: string;
  /** Rótulo do formulário de cadastro. */
  rotulo: string;
  /** Rótulo curto, para cards e tabelas onde não há espaço. */
  rotuloCurto: string;
  /** Rótulo do filtro da listagem ("Apenas ..."), que é outra pergunta. */
  rotuloFiltro: string;
}

/**
 * Os três valores canônicos. O `valor` é tipado como `TipoFornecedor`, não `string`: é aqui que
 * o domínio precisa ser checado pelo compilador — `OpcaoTipoFornecimento.valor` é largo de
 * propósito, porque a lista devolvida ao seletor pode carregar um legado fora do domínio.
 */
export const TIPOS_FORNECIMENTO: readonly (OpcaoTipoFornecimento & { valor: TipoFornecedor })[] = [
  {
    valor: 'produtos',
    rotulo: 'Produtos / Insumos',
    rotuloCurto: 'Produtos',
    rotuloFiltro: 'Apenas Produtos',
  },
  {
    valor: 'servicos',
    rotulo: 'Prestador de Serviços',
    rotuloCurto: 'Serviços',
    rotuloFiltro: 'Apenas Serviços',
  },
  {
    valor: 'ambos',
    rotulo: 'Produtos e Serviços (Ambos)',
    rotuloCurto: 'Produtos & Serviços',
    rotuloFiltro: 'Produtos e Serviços',
  },
];

/**
 * Rótulo de um valor gravado.
 *
 * **Valor fora do domínio volta como está**, em vez de virar vazio: um fornecedor gravado antes
 * do `CHECK` — ou vindo do IndexedDB de um navegador que usou o "Gerenciar" — continua legível
 * na tela em vez de aparecer sem nome. É a mesma escolha de `mascararDocumento`, que devolve o
 * original quando o valor não é documento.
 */
export const rotuloTipoFornecimento = (valor: string | null | undefined): string =>
  TIPOS_FORNECIMENTO.find((t) => t.valor === valor)?.rotuloCurto || (valor || '');

/** Idem, com o rótulo longo do formulário. */
export const rotuloLongoTipoFornecimento = (valor: string | null | undefined): string =>
  TIPOS_FORNECIMENTO.find((t) => t.valor === valor)?.rotulo || (valor || '');

/**
 * Opções do select do cadastro, preservando o valor **já gravado** mesmo fora do domínio.
 *
 * Sem isso, abrir para editar um fornecedor com valor legado perderia a seleção e o save
 * gravaria outro tipo em silêncio — a mesma armadilha que `nomesDeCategoriaParaSelecao` e o
 * seletor de conta contábil já evitam.
 */
export const opcoesTipoFornecimento = (
  valorJaGravado?: string | null
): OpcaoTipoFornecimento[] => {
  // Anotado, e não inferido: `TIPOS_FORNECIMENTO` é do tipo estreito (só os três canônicos), e
  // é exatamente aqui que um valor legado pode entrar na lista. O `tsc` cobra essa fronteira.
  const opcoes: OpcaoTipoFornecimento[] = [...TIPOS_FORNECIMENTO];
  const atual = (valorJaGravado || '').trim();
  if (atual && !opcoes.some((t) => t.valor === atual)) {
    opcoes.push({
      valor: atual,
      rotulo: atual,
      rotuloCurto: atual,
      rotuloFiltro: atual,
    });
  }
  return opcoes;
};
