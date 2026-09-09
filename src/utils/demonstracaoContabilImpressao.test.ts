import { describe, it, expect } from 'vitest';
import {
  montarHtmlImpressaoDemonstracao,
  escaparHtml,
  CSS_IMPRESSAO_DEMONSTRACAO,
  DadosDemonstracao,
} from './demonstracaoContabilImpressao';
import type { LinhaDemonstracao } from './demonstracaoContabil';

const linha = (over: Partial<LinhaDemonstracao> & { codigo: string; nome: string }): LinhaDemonstracao => ({
  id: over.codigo,
  natureza: 'receita',
  tipo: 'analitica',
  nivel: 1,
  ativo: true,
  previsto: 0,
  realizado: 0,
  execucao: null,
  ...over,
});

const dados = (over?: Partial<DadosDemonstracao>): DadosDemonstracao => ({
  cabecalho: {
    empresaNome: 'ERAS PAX TAQUARI',
    empresaCnpj: '33.520.000/0001-71',
    empresaEndereco: 'Rua das Flores, 100',
    logoUrl: null,
    exercicio: 2026,
    planoNome: 'Plano Padrão',
    geradoPor: 'Operador',
    geradoEm: new Date('2026-09-09T15:00:00Z'),
  },
  linhas: [
    linha({ codigo: '3', nome: 'Receitas', tipo: 'sintetica', previsto: 1000, realizado: 250, execucao: 25 }),
    linha({ codigo: '3.1.01', nome: 'Mensalidades', nivel: 3, previsto: 1000, realizado: 250, execucao: 25 }),
  ],
  resumo: {
    receita: { previsto: 1000, realizado: 250 },
    despesa: { previsto: 400, realizado: 400 },
    resultado: { previsto: 600, realizado: -150 },
  },
  foraDoExercicio: { previsto: 0, realizado: 0 },
  naoClassificado: { previsto: 0, realizado: 0 },
  ...over,
});

describe('escaparHtml', () => {
  it('neutraliza marcação vinda do nome cadastrado pelo usuário', () => {
    expect(escaparHtml('<script>x</script>')).toBe('&lt;script&gt;x&lt;/script&gt;');
    expect(escaparHtml(null)).toBe('');
  });
});

describe('CSS_IMPRESSAO_DEMONSTRACAO', () => {
  it('nomeia as próprias classes — não existe Tailwind na janela de impressão', () => {
    for (const regra of ['.dc-cabecalho', '.dc-cartao', 'table.dc-tabela', '.dc-num', '.dc-grupo', '.dc-nota']) {
      expect(CSS_IMPRESSAO_DEMONSTRACAO).toContain(regra);
    }
  });

  it('define o alinhamento à direita das colunas de valor por CSS próprio', () => {
    // `text-right` do Tailwind seria inerte aqui; a regra tem que existir nomeada.
    expect(CSS_IMPRESSAO_DEMONSTRACAO).toMatch(/td\.dc-num\s*\{[^}]*text-align:\s*right/);
  });

  it('repete o cabeçalho da tabela em toda página e não quebra linha ao meio', () => {
    expect(CSS_IMPRESSAO_DEMONSTRACAO).toMatch(/thead\s*\{\s*display:\s*table-header-group/);
    expect(CSS_IMPRESSAO_DEMONSTRACAO).toMatch(/tr\s*\{\s*page-break-inside:\s*avoid/);
  });
});

describe('montarHtmlImpressaoDemonstracao', () => {
  it('não usa nenhuma classe utilitária do Tailwind no corpo', () => {
    const html = montarHtmlImpressaoDemonstracao(dados());
    for (const utilitaria of ['class="text-right', 'class="font-bold', 'class="flex', 'class="tabular-nums', 'class="w-28']) {
      expect(html).not.toContain(utilitaria);
    }
  });

  it('traz o CSS embutido — a janela nova não herda folha de estilo nenhuma', () => {
    expect(montarHtmlImpressaoDemonstracao(dados())).toContain(CSS_IMPRESSAO_DEMONSTRACAO);
  });

  it('mostra o CNPJ do emitente sem máscara', () => {
    // É a identificação de quem emite o documento, e é dado público — ver mascaraDocumento.ts.
    expect(montarHtmlImpressaoDemonstracao(dados())).toContain('33.520.000/0001-71');
  });

  it('imprime valores em real e a execução em porcentagem', () => {
    const html = montarHtmlImpressaoDemonstracao(dados());
    expect(html).toContain('Mensalidades');
    expect(html).toMatch(/R\$\s*1\.000,00/);
    expect(html).toContain('25%');
  });

  it('marca o resultado negativo com a classe própria, não com cor solta', () => {
    expect(montarHtmlImpressaoDemonstracao(dados())).toContain('dc-cartao dc-negativo');
    const positivo = montarHtmlImpressaoDemonstracao(
      dados({ resumo: { receita: { previsto: 0, realizado: 10 }, despesa: { previsto: 0, realizado: 1 }, resultado: { previsto: 0, realizado: 9 } } }),
    );
    expect(positivo).toContain('dc-cartao dc-positivo');
  });

  it('indenta a conta pelo nível, já que não há classe de padding disponível', () => {
    const html = montarHtmlImpressaoDemonstracao(dados());
    expect(html).toContain('&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;3.1.01');
  });

  it('só imprime a nota de fora-do-exercício quando existe valor lá', () => {
    expect(montarHtmlImpressaoDemonstracao(dados())).not.toContain('Fora do exercício 2026');
    const com = montarHtmlImpressaoDemonstracao(dados({ foraDoExercicio: { previsto: 500, realizado: 0 } }));
    expect(com).toContain('Fora do exercício 2026');
    expect(com).toContain('dc-nota-alerta');
  });

  it('sempre explica os critérios — o leitor do papel não tem a tela para conferir', () => {
    expect(montarHtmlImpressaoDemonstracao(dados())).toContain('<b>Critérios:</b>');
  });

  it('avisa quando não há nenhuma conta, em vez de imprimir tabela vazia', () => {
    const html = montarHtmlImpressaoDemonstracao(dados({ linhas: [] }));
    expect(html).toContain('Nenhuma conta com movimento neste exercício.');
  });

  it('escapa o nome da empresa dentro do título e do cabeçalho', () => {
    const html = montarHtmlImpressaoDemonstracao(
      dados({ cabecalho: { ...dados().cabecalho, empresaNome: 'PAX & "CIA" <b>' } }),
    );
    expect(html).not.toContain('PAX & "CIA" <b>');
    expect(html).toContain('PAX &amp; &quot;CIA&quot; &lt;b&gt;');
  });
});
