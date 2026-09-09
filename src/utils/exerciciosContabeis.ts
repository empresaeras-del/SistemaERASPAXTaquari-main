/**
 * Escolha do exercício de destino ao duplicar um plano de contas.
 *
 * Existe por causa de um bug real: a primeira versão só oferecia a duplicação quando o plano
 * exibido era de um ano **anterior** ao corrente (`plano.exercicio < anoAtual`). Como a empresa
 * monta o plano no ano em que está, essa condição nunca era verdadeira — o botão só apareceria
 * em 1º de janeiro, exatamente quando já é tarde: os lançamentos do ano novo já teriam começado
 * a cair no plano do ano anterior, pela queda de `getPlanoAtivo`.
 *
 * A regra certa é a inversa: **preparar o exercício seguinte é trabalho de dezembro**, então a
 * ação fica sempre disponível e o destino sugerido é o próximo ano que ainda não tem plano.
 */
import { PlanoContabil } from '../types/planoContabil';

/** Anos que já têm plano, sem repetição. */
export function exerciciosExistentes(planos: PlanoContabil[]): number[] {
  const anos = new Set<number>();
  for (const p of planos) {
    if (typeof p?.exercicio === 'number') anos.add(p.exercicio);
  }
  return Array.from(anos).sort((a, b) => a - b);
}

/**
 * Primeiro exercício **a partir de** `base` que ainda não tem plano.
 *
 * Com plano só de 2026 e `base = 2026`, sugere 2027. Se 2027 também existir, sugere 2028 — a
 * busca anda para frente em vez de parar, para a empresa que já preparou o ano seguinte
 * conseguir preparar o subsequente. O teto de 2200 é o mesmo do `CHECK` da coluna; sem ele um
 * dado corrompido faria um laço infinito.
 */
export function proximoExercicioLivre(planos: PlanoContabil[], base: number): number {
  const ocupados = new Set(exerciciosExistentes(planos));
  let ano = Math.max(base, 1900) + 1;
  while (ocupados.has(ano) && ano < 2200) ano++;
  return ano;
}

/** O ano é aceitável como exercício? Mesma faixa do `CHECK` da coluna. */
export function exercicioValido(ano: number): boolean {
  return Number.isInteger(ano) && ano >= 1900 && ano <= 2200;
}
