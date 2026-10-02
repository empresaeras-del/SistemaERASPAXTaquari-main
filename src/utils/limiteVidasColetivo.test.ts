import { describe, it, expect } from 'vitest';
import {
  limiteDeVidasEfetivo,
  limiteEhPersonalizado,
  excedeLimiteDeVidas,
  valorExclusivoDoAssociado,
  temValorExclusivo,
  mensalidadeDoAssociado,
  origemDaMensalidade,
} from './limiteVidasColetivo';

const coletivo = (limite: number | null) =>
  ({ tipo_plano: 'coletivo' as const, limite_vidas: limite ?? undefined });
const individual = { tipo_plano: 'individual' as const, limite_vidas: undefined };

describe('limiteDeVidasEfetivo', () => {
  it('usa o limite do plano quando o associado não tem personalizado', () => {
    expect(limiteDeVidasEfetivo(coletivo(2), {})).toBe(2);
    expect(limiteDeVidasEfetivo(coletivo(2), { limite_vidas_personalizado: null })).toBe(2);
  });

  it('o personalizado do associado sobrepõe o do plano', () => {
    expect(limiteDeVidasEfetivo(coletivo(2), { limite_vidas_personalizado: 7 })).toBe(7);
  });

  /**
   * O personalizado é o ACORDO, não um bônus. Um limite menor que o do plano é tão legítimo
   * quanto um maior, e tratá-lo como `Math.max` faria o sistema ignorar em silêncio o que o
   * operador digitou.
   */
  it('o personalizado vale mesmo sendo MENOR que o do plano', () => {
    expect(limiteDeVidasEfetivo(coletivo(5), { limite_vidas_personalizado: 2 })).toBe(2);
  });

  /**
   * Em plano individual o preço escala com as vidas — não existe teto para personalizar.
   * Aceitar o número aqui inventaria um limite que o produto não tem.
   */
  it('plano individual não tem limite, mesmo com personalizado gravado', () => {
    expect(limiteDeVidasEfetivo(individual, { limite_vidas_personalizado: 3 })).toBeNull();
  });

  it('coletivo sem limite declarado é ilimitado, não 999', () => {
    expect(limiteDeVidasEfetivo(coletivo(null), {})).toBeNull();
    expect(limiteDeVidasEfetivo(coletivo(0), {})).toBeNull();
  });

  it('sem plano não há limite', () => {
    expect(limiteDeVidasEfetivo(null, { limite_vidas_personalizado: 4 })).toBeNull();
    expect(limiteDeVidasEfetivo(undefined, undefined)).toBeNull();
  });

  it('personalizado quebrado (0 ou negativo) cai para o do plano', () => {
    expect(limiteDeVidasEfetivo(coletivo(2), { limite_vidas_personalizado: 0 })).toBe(2);
    expect(limiteDeVidasEfetivo(coletivo(2), { limite_vidas_personalizado: -3 })).toBe(2);
  });
});

describe('limiteEhPersonalizado', () => {
  it('diz de onde o limite veio', () => {
    expect(limiteEhPersonalizado(coletivo(2), { limite_vidas_personalizado: 7 })).toBe(true);
    expect(limiteEhPersonalizado(coletivo(2), {})).toBe(false);
    expect(limiteEhPersonalizado(individual, { limite_vidas_personalizado: 7 })).toBe(false);
  });
});

describe('excedeLimiteDeVidas', () => {
  it('compara com o limite do plano quando não há personalizado', () => {
    expect(excedeLimiteDeVidas(coletivo(2), {}, 3)).toBe(true);
    expect(excedeLimiteDeVidas(coletivo(2), {}, 2)).toBe(false);
  });

  /**
   * O caso que motivou a mudança: a família de 7 vidas num plano de limite 2. Com o limite
   * personalizado acordado, ela deixa de aparecer como excesso — era o aviso que 11 dos 16
   * ativos recebiam permanentemente.
   */
  it('o limite personalizado tira do excesso quem tem acordo', () => {
    expect(excedeLimiteDeVidas(coletivo(2), { limite_vidas_personalizado: 7 }, 7)).toBe(false);
    expect(excedeLimiteDeVidas(coletivo(2), { limite_vidas_personalizado: 7 }, 8)).toBe(true);
  });

  it('plano individual nunca excede', () => {
    expect(excedeLimiteDeVidas(individual, {}, 50)).toBe(false);
  });

  it('coletivo sem limite declarado nunca excede', () => {
    expect(excedeLimiteDeVidas(coletivo(null), {}, 500)).toBe(false);
  });
});

describe('valorExclusivoDoAssociado', () => {
  it('devolve o valor acordado', () => {
    expect(valorExclusivoDoAssociado({ valor_mensalidade_exclusivo: 63 })).toBe(63);
  });

  /** A coluna é `numeric` e o Supabase a devolve como string — coagir aqui, não em cada tela. */
  it('coage a string que o Supabase devolve para numeric', () => {
    expect(valorExclusivoDoAssociado({ valor_mensalidade_exclusivo: '63.00' })).toBe(63);
  });

  it('ausência é null — e é ela que devolve o cálculo do plano', () => {
    expect(valorExclusivoDoAssociado({})).toBeNull();
    expect(valorExclusivoDoAssociado({ valor_mensalidade_exclusivo: null })).toBeNull();
    expect(valorExclusivoDoAssociado(undefined)).toBeNull();
    expect(valorExclusivoDoAssociado({ valor_mensalidade_exclusivo: '' })).toBeNull();
  });

  /**
   * Zero é mensalidade de cortesia, não campo vazio. Um `Number(x) || calculado` trataria os
   * dois como a mesma coisa e o valor do plano voltaria sozinho depois de digitar `0`.
   */
  it('zero é valor, não ausência', () => {
    expect(valorExclusivoDoAssociado({ valor_mensalidade_exclusivo: 0 })).toBe(0);
    expect(mensalidadeDoAssociado({ valor_mensalidade_exclusivo: 0 }, 21)).toBe(0);
  });

  it('recusa negativo e o que não é número', () => {
    expect(valorExclusivoDoAssociado({ valor_mensalidade_exclusivo: -1 })).toBeNull();
    expect(valorExclusivoDoAssociado({ valor_mensalidade_exclusivo: 'abc' })).toBeNull();
  });
});

describe('mensalidadeDoAssociado', () => {
  it('o exclusivo vence o cálculo do plano', () => {
    expect(mensalidadeDoAssociado({ valor_mensalidade_exclusivo: 63 }, 21)).toBe(63);
  });

  it('sem exclusivo, devolve o que o chamador calculou do plano', () => {
    expect(mensalidadeDoAssociado({}, 21)).toBe(21);
    expect(mensalidadeDoAssociado(null, 60)).toBe(60);
  });

  /**
   * O caso de plano individual que justifica a coluna separada: sem exclusivo, a mensalidade
   * acompanha o cálculo (que escala com as vidas); com exclusivo, ela fica onde foi acordada.
   */
  it('sem exclusivo o valor acompanha o cálculo quando as vidas mudam', () => {
    expect(mensalidadeDoAssociado({}, 40)).toBe(40);
    expect(mensalidadeDoAssociado({}, 60)).toBe(60);
    expect(mensalidadeDoAssociado({ valor_mensalidade_exclusivo: 55 }, 40)).toBe(55);
    expect(mensalidadeDoAssociado({ valor_mensalidade_exclusivo: 55 }, 60)).toBe(55);
  });
});

describe('temValorExclusivo / origemDaMensalidade', () => {
  it('a procedência do número é dita, não deduzida', () => {
    expect(temValorExclusivo({ valor_mensalidade_exclusivo: 63 })).toBe(true);
    expect(temValorExclusivo({})).toBe(false);

    expect(origemDaMensalidade({ valor_mensalidade_exclusivo: 63 }, 'Valor Base Coletivo')).toBe(
      'Valor exclusivo deste associado',
    );
    expect(origemDaMensalidade({}, 'Valor Base Coletivo')).toBe('Valor Base Coletivo');
  });
});
