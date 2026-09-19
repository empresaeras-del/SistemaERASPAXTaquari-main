import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DOMINIOS_DO_BANCO,
  UNIOES_PERSISTIDAS,
} from '../config/dominiosDoBanco';

/**
 * As duas metades do domínio precisam concordar: a union do TypeScript e o `CHECK` do Postgres.
 *
 * Este projeto já teve quatro defeitos dessa classe, e todos tinham a mesma forma — a tela
 * oferece um valor que o banco recusa, e ninguém sabe até alguém tentar. O `23514` chega ao
 * operador como "erro ao salvar", sem dizer qual campo; e onde havia um `catch` que só avisava
 * no console, nem isso chegava.
 *
 * **O teste lê o fonte, não o tipo.** Uma union do TypeScript é apagada na compilação: não há o
 * que importar em tempo de execução. A alternativa seria declarar cada domínio como
 * `['a','b'] as const` e derivar o tipo dele — mais robusto, e uma reescrita de 16 tipos que
 * não cabia nesta rodada. Ler o fonte por regex é frágil de propósito controlado: se a regex
 * parar de casar, o primeiro teste abaixo **falha** em vez de passar vazio, que é a diferença
 * entre um guarda e um enfeite.
 */

const RAIZ = path.resolve(__dirname, '..');

/** Extrai os literais de `export type X = 'a' | 'b';`, em uma linha ou em várias. */
const lerUniao = (arquivo: string, nome: string): string[] | null => {
  const fonte = fs.readFileSync(path.join(RAIZ, arquivo), 'utf8');
  const m = fonte.match(new RegExp(`export type ${nome}\\s*=\\s*([^;]+);`));
  if (!m) return null;
  const literais = m[1].match(/'([^']+)'/g);
  if (!literais) return null;
  return literais.map((l) => l.slice(1, -1));
};

describe('os domínios do TypeScript e os CHECK do Postgres concordam', () => {
  const pares = Object.entries(UNIOES_PERSISTIDAS);

  it('o mapa não aponta para domínio que não existe no retrato', () => {
    for (const [nome, { dominio }] of pares) {
      expect(DOMINIOS_DO_BANCO[dominio], `${nome} → ${dominio}`).toBeDefined();
    }
  });

  it.each(pares)('%s: a union é encontrada no fonte', (nome, { arquivo }) => {
    // Falhar aqui significa que a regex parou de casar (a declaração mudou de forma, o arquivo
    // se moveu, a union foi renomeada). É proposital que isso reprove: um teste que não acha o
    // que deveria checar passaria vazio e mentiria.
    expect(lerUniao(arquivo, nome), `${nome} em src/${arquivo}`).not.toBeNull();
  });

  it.each(pares)(
    '%s: todo valor do TypeScript é aceito pelo banco',
    (nome, { arquivo, dominio }) => {
      const doTs = lerUniao(arquivo, nome) ?? [];
      const doBanco = DOMINIOS_DO_BANCO[dominio] ?? [];
      // Esta é a direção que QUEBRA: a tela oferece, o operador escolhe, o Postgres recusa com
      // 23514. Foi assim com `requisicoes.status` = 'emitida' e com `fornecedores.status` =
      // 'bloqueado'.
      const recusados = doTs.filter((v) => !doBanco.includes(v));
      expect(recusados, `${nome} declara valores que ${dominio} recusa`).toEqual([]);
    },
  );

  it.each(pares)(
    '%s: valor que só existe no banco está declarado como exceção, com motivo',
    (nome, { arquivo, dominio, soNoBanco }) => {
      const doTs = lerUniao(arquivo, nome) ?? [];
      const doBanco = DOMINIOS_DO_BANCO[dominio] ?? [];
      // Esta direção não quebra a gravação, mas o valor fica sem rótulo, fora do filtro e fora
      // dos contadores — visível só na coluna crua. Passa só se houver um motivo escrito.
      const semExplicacao = doBanco.filter((v) => !doTs.includes(v) && !soNoBanco?.[v]);
      expect(
        semExplicacao,
        `${dominio} aceita valores que ${nome} não conhece e que ninguém explicou`,
      ).toEqual([]);
    },
  );

  it('toda exceção declarada existe mesmo no banco', () => {
    // Uma exceção que sobrou depois de o valor sair do CHECK viraria documentação errada.
    for (const [nome, { dominio, soNoBanco }] of pares) {
      for (const valor of Object.keys(soNoBanco ?? {})) {
        expect(
          DOMINIOS_DO_BANCO[dominio],
          `${nome} explica '${valor}', que ${dominio} não aceita`,
        ).toContain(valor);
      }
    }
  });

  it('o motivo de cada exceção é uma frase, não um rótulo', () => {
    for (const [nome, { soNoBanco }] of pares) {
      for (const [valor, motivo] of Object.entries(soNoBanco ?? {})) {
        expect(motivo.length, `${nome}.${valor}`).toBeGreaterThan(30);
      }
    }
  });
});

describe('o retrato do banco está íntegro', () => {
  it('toda chave é `tabela.coluna` e tem ao menos dois valores', () => {
    for (const [chave, valores] of Object.entries(DOMINIOS_DO_BANCO)) {
      expect(chave, 'chave fora do formato tabela.coluna').toMatch(/^[a-z_]+\.[a-z_]+$/);
      // Um domínio de um valor só não é domínio — seria um DEFAULT. Se aparecer, é erro de
      // extração.
      expect(valores.length, chave).toBeGreaterThan(1);
    }
  });

  it('nenhum domínio tem valor repetido', () => {
    for (const [chave, valores] of Object.entries(DOMINIOS_DO_BANCO)) {
      expect(new Set(valores).size, chave).toBe(valores.length);
    }
  });
});
