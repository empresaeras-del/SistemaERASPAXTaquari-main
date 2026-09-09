import { describe, it, expect } from 'vitest';
import {
  nivelDoCodigo,
  codigoDoPai,
  compararCodigos,
  montarArvore,
  achatarArvore,
  contasLancaveis,
  descendentesDe,
  paisPossiveis,
  validarConta,
  proximoCodigo,
} from './planoContabilTree';
import type { ContaContabil } from '../types/planoContabil';
import { PLANO_CONTABIL_PADRAO } from '../config/planoContabilPadrao.config';

const conta = (over: Partial<ContaContabil> & { id: string; codigo: string }): ContaContabil => ({
  tenant_id: 't1',
  plano_id: 'p1',
  nome: `Conta ${over.codigo}`,
  natureza: 'receita',
  tipo: 'analitica',
  nivel: 1,
  ativo: true,
  ...over,
});

// 3 ─ 3.1 ─ 3.1.01
//         └ 3.1.02
//   └ 3.2
// 4 ─ 4.1 (despesa)
const BASE: ContaContabil[] = [
  conta({ id: 'r3', codigo: '3', nome: 'RECEITAS', tipo: 'sintetica' }),
  conta({ id: 'r31', codigo: '3.1', nome: 'Operacionais', tipo: 'sintetica', conta_pai_id: 'r3' }),
  conta({ id: 'r3101', codigo: '3.1.01', nome: 'Mensalidades', conta_pai_id: 'r31' }),
  conta({ id: 'r3102', codigo: '3.1.02', nome: 'Adesão', conta_pai_id: 'r31' }),
  conta({ id: 'r32', codigo: '3.2', nome: 'Não Operacionais', tipo: 'sintetica', conta_pai_id: 'r3' }),
  conta({ id: 'd4', codigo: '4', nome: 'DESPESAS', tipo: 'sintetica', natureza: 'despesa' }),
  conta({ id: 'd41', codigo: '4.1', nome: 'Aluguel', natureza: 'despesa', conta_pai_id: 'd4' }),
];

describe('nivelDoCodigo', () => {
  it('conta os segmentos', () => {
    expect(nivelDoCodigo('3')).toBe(1);
    expect(nivelDoCodigo('3.1')).toBe(2);
    expect(nivelDoCodigo('3.1.01')).toBe(3);
  });

  it('código vazio é nível 1, não 0', () => {
    expect(nivelDoCodigo('')).toBe(1);
    expect(nivelDoCodigo('...')).toBe(1);
  });
});

describe('codigoDoPai', () => {
  it('remove o último segmento', () => {
    expect(codigoDoPai('3.1.01')).toBe('3.1');
    expect(codigoDoPai('3.1')).toBe('3');
  });

  it('raiz não tem pai', () => {
    expect(codigoDoPai('3')).toBeNull();
    expect(codigoDoPai('')).toBeNull();
  });
});

describe('compararCodigos', () => {
  it('ordena por número, não por texto — 3.1.10 vem depois de 3.1.9', () => {
    const ordenado = ['3.1.10', '3.1.9', '3.1.2'].sort(compararCodigos);
    expect(ordenado).toEqual(['3.1.2', '3.1.9', '3.1.10']);
  });

  it('o pai vem antes da filha', () => {
    expect(compararCodigos('3.1', '3.1.01')).toBeLessThan(0);
  });

  it('não quebra com segmento não numérico', () => {
    const ordenado = ['3.B', '3.A'].sort(compararCodigos);
    expect(ordenado).toEqual(['3.A', '3.B']);
  });

  it('códigos iguais empatam', () => {
    expect(compararCodigos('3.1', '3.1')).toBe(0);
  });
});

describe('montarArvore', () => {
  it('aninha filhas no pai e devolve só as raízes', () => {
    const arvore = montarArvore(BASE);
    expect(arvore.map((n) => n.codigo)).toEqual(['3', '4']);

    const receitas = arvore[0];
    expect(receitas.filhas.map((n) => n.codigo)).toEqual(['3.1', '3.2']);
    expect(receitas.filhas[0].filhas.map((n) => n.codigo)).toEqual(['3.1.01', '3.1.02']);
  });

  it('conta órfã sobe para a raiz em vez de sumir da tela', () => {
    const orfa = conta({ id: 'x', codigo: '9.9', conta_pai_id: 'pai-que-nao-existe' });
    const arvore = montarArvore([...BASE, orfa]);
    expect(arvore.map((n) => n.codigo)).toContain('9.9');
  });

  it('conta apontando para si mesma não vira filha de si mesma', () => {
    const ciclo = conta({ id: 'z', codigo: '8', conta_pai_id: 'z' });
    const arvore = montarArvore([ciclo]);
    expect(arvore).toHaveLength(1);
    expect(arvore[0].filhas).toEqual([]);
  });

  it('lista vazia devolve árvore vazia', () => {
    expect(montarArvore([])).toEqual([]);
  });

  it('não muda a lista original', () => {
    montarArvore(BASE);
    expect(BASE).toHaveLength(7);
    expect((BASE[0] as unknown as { filhas?: unknown }).filhas).toBeUndefined();
  });
});

describe('achatarArvore', () => {
  it('devolve na ordem em que a tela renderiza', () => {
    expect(achatarArvore(montarArvore(BASE)).map((n) => n.codigo)).toEqual([
      '3', '3.1', '3.1.01', '3.1.02', '3.2', '4', '4.1',
    ]);
  });
});

describe('contasLancaveis', () => {
  it('só analíticas, filtradas por natureza', () => {
    expect(contasLancaveis(BASE, 'receita').map((c) => c.codigo)).toEqual(['3.1.01', '3.1.02']);
    expect(contasLancaveis(BASE, 'despesa').map((c) => c.codigo)).toEqual(['4.1']);
  });

  it('sem natureza devolve todas as analíticas', () => {
    expect(contasLancaveis(BASE)).toHaveLength(3);
  });

  it('ignora inativa e excluída', () => {
    const lista = [
      ...BASE,
      conta({ id: 'i', codigo: '3.1.03', conta_pai_id: 'r31', ativo: false }),
      conta({ id: 'e', codigo: '3.1.04', conta_pai_id: 'r31', deleted_at: '2026-09-09T00:00:00Z' }),
    ];
    expect(contasLancaveis(lista, 'receita').map((c) => c.codigo)).toEqual(['3.1.01', '3.1.02']);
  });
});

describe('descendentesDe', () => {
  it('pega filhas e netas', () => {
    expect(descendentesDe(BASE, 'r3').sort()).toEqual(['r31', 'r3101', 'r3102', 'r32'].sort());
  });

  it('folha não tem descendente', () => {
    expect(descendentesDe(BASE, 'r3101')).toEqual([]);
  });

  it('não entra em laço infinito se houver ciclo nos dados', () => {
    const a = conta({ id: 'a', codigo: '5', tipo: 'sintetica', conta_pai_id: 'b' });
    const b = conta({ id: 'b', codigo: '5.1', tipo: 'sintetica', conta_pai_id: 'a' });
    expect(descendentesDe([a, b], 'a')).toEqual(['b']);
  });
});

describe('paisPossiveis', () => {
  it('só sintéticas da mesma natureza', () => {
    expect(paisPossiveis(BASE, 'receita', null).map((c) => c.codigo)).toEqual(['3', '3.1', '3.2']);
    expect(paisPossiveis(BASE, 'despesa', null).map((c) => c.codigo)).toEqual(['4']);
  });

  it('não oferece a própria conta nem descendentes dela — é o que impede o ciclo', () => {
    const opcoes = paisPossiveis(BASE, 'receita', 'r31').map((c) => c.codigo);
    expect(opcoes).toEqual(['3', '3.2']);
    expect(opcoes).not.toContain('3.1');
  });

  it('ignora sintética inativa', () => {
    const lista = [...BASE, conta({ id: 's', codigo: '3.3', tipo: 'sintetica', conta_pai_id: 'r3', ativo: false })];
    expect(paisPossiveis(lista, 'receita', null).map((c) => c.codigo)).not.toContain('3.3');
  });
});

describe('validarConta', () => {
  const valida = { codigo: '3.1.03', nome: 'Nova', natureza: 'receita' as const, tipo: 'analitica' as const, conta_pai_id: 'r31' };

  it('aceita uma conta correta', () => {
    expect(validarConta(valida, BASE)).toEqual([]);
  });

  it('recusa código duplicado no mesmo plano', () => {
    const erros = validarConta({ ...valida, codigo: '3.1.01' }, BASE);
    expect(erros.map((e) => e.campo)).toContain('codigo');
    expect(erros[0].mensagem).toContain('3.1.01');
  });

  it('deixa a própria conta manter o código ao editar', () => {
    expect(validarConta({ ...valida, id: 'r3101', codigo: '3.1.01' }, BASE)).toEqual([]);
  });

  it('recusa código vazio e código com formato inválido', () => {
    expect(validarConta({ ...valida, codigo: '' }, BASE).map((e) => e.campo)).toContain('codigo');
    expect(validarConta({ ...valida, codigo: '3 . 1' }, BASE).map((e) => e.campo)).toContain('codigo');
    expect(validarConta({ ...valida, codigo: '3..1' }, BASE).map((e) => e.campo)).toContain('codigo');
  });

  it('recusa nome vazio ou só espaços', () => {
    expect(validarConta({ ...valida, nome: '   ' }, BASE).map((e) => e.campo)).toContain('nome');
  });

  it('recusa pai analítico — só grupo tem filhas', () => {
    const erros = validarConta({ ...valida, conta_pai_id: 'r3101' }, BASE);
    expect(erros.map((e) => e.campo)).toContain('conta_pai_id');
  });

  it('recusa pai de natureza diferente', () => {
    const erros = validarConta({ ...valida, conta_pai_id: 'd4' }, BASE);
    expect(erros.map((e) => e.campo)).toContain('natureza');
  });

  it('recusa ser pai de si mesma', () => {
    const erros = validarConta({ ...valida, id: 'r31', codigo: '3.1', conta_pai_id: 'r31' }, BASE);
    expect(erros.map((e) => e.campo)).toContain('conta_pai_id');
  });

  it('recusa pai que é descendente — o ciclo que o banco não barra', () => {
    const erros = validarConta({ ...valida, id: 'r3', codigo: '3', tipo: 'sintetica', conta_pai_id: 'r31' }, BASE);
    expect(erros.map((e) => e.campo)).toContain('conta_pai_id');
    expect(erros.some((e) => e.mensagem.includes('ciclo'))).toBe(true);
  });

  it('recusa pai inexistente', () => {
    const erros = validarConta({ ...valida, conta_pai_id: 'sumiu' }, BASE);
    expect(erros.map((e) => e.campo)).toContain('conta_pai_id');
  });

  it('conta raiz sem pai é válida', () => {
    expect(validarConta({ codigo: '5', nome: 'Raiz', natureza: 'receita', tipo: 'sintetica' }, BASE)).toEqual([]);
  });
});

describe('proximoCodigo', () => {
  it('sugere o próximo dentro do pai, preservando o zero à esquerda das irmãs', () => {
    expect(proximoCodigo(BASE, '3.1')).toBe('3.1.03');
  });

  it('primeiro filho de um grupo vazio começa em 01', () => {
    expect(proximoCodigo(BASE, '3.2')).toBe('3.2.01');
  });

  it('sem pai sugere a próxima raiz', () => {
    expect(proximoCodigo(BASE, null)).toBe('5');
  });

  it('respeita largura maior já usada pelas irmãs', () => {
    const lista = [conta({ id: 'a', codigo: '3.1.001', conta_pai_id: 'r31' })];
    expect(proximoCodigo(lista, '3.1')).toBe('3.1.002');
  });

  it('ignora irmã com segmento não numérico', () => {
    const lista = [conta({ id: 'a', codigo: '3.1.AA', conta_pai_id: 'r31' })];
    expect(proximoCodigo(lista, '3.1')).toBe('3.1.01');
  });
});

/**
 * `semearPlanoPadrao` resolve `conta_pai_id` pelo código do pai **já inserido**, então a
 * ordem do array não é cosmética: uma conta que apareça antes do próprio pai seria criada
 * com `conta_pai_id: null` — órfã, sem erro nenhum na tela. Estes testes travam isso.
 */
describe('PLANO_CONTABIL_PADRAO (invariantes que a semeadura assume)', () => {
  it('todo pai aparece antes das filhas', () => {
    const vistos = new Set<string>();
    for (const c of PLANO_CONTABIL_PADRAO) {
      const pai = codigoDoPai(c.codigo);
      if (pai) {
        expect(vistos.has(pai), `${c.codigo} aparece antes do pai ${pai}`).toBe(true);
      }
      vistos.add(c.codigo);
    }
  });

  it('todo pai referenciado existe no modelo', () => {
    const codigos = new Set(PLANO_CONTABIL_PADRAO.map((c) => c.codigo));
    for (const c of PLANO_CONTABIL_PADRAO) {
      const pai = codigoDoPai(c.codigo);
      if (pai) expect(codigos.has(pai), `pai ${pai} de ${c.codigo} não existe`).toBe(true);
    }
  });

  it('não repete código', () => {
    const codigos = PLANO_CONTABIL_PADRAO.map((c) => c.codigo);
    expect(new Set(codigos).size).toBe(codigos.length);
  });

  it('filha tem a mesma natureza do pai', () => {
    const porCodigo = new Map(PLANO_CONTABIL_PADRAO.map((c) => [c.codigo, c]));
    for (const c of PLANO_CONTABIL_PADRAO) {
      const pai = codigoDoPai(c.codigo);
      if (pai) expect(porCodigo.get(pai)?.natureza).toBe(c.natureza);
    }
  });

  it('só conta sintética tem filhas — analítica é folha', () => {
    const porCodigo = new Map(PLANO_CONTABIL_PADRAO.map((c) => [c.codigo, c]));
    for (const c of PLANO_CONTABIL_PADRAO) {
      const pai = codigoDoPai(c.codigo);
      if (pai) expect(porCodigo.get(pai)?.tipo).toBe('sintetica');
    }
  });

  it('todo código passa na validação de formato usada pelo formulário', () => {
    const contasVazias: ContaContabil[] = [];
    for (const c of PLANO_CONTABIL_PADRAO) {
      const erros = validarConta(
        { codigo: c.codigo, nome: c.nome, natureza: c.natureza, tipo: c.tipo },
        contasVazias,
      );
      expect(erros, `${c.codigo} ${c.nome}: ${JSON.stringify(erros)}`).toEqual([]);
    }
  });

  it('tem contas lançáveis das duas naturezas', () => {
    const analiticas = PLANO_CONTABIL_PADRAO.filter((c) => c.tipo === 'analitica');
    expect(analiticas.some((c) => c.natureza === 'receita')).toBe(true);
    expect(analiticas.some((c) => c.natureza === 'despesa')).toBe(true);
  });
});
