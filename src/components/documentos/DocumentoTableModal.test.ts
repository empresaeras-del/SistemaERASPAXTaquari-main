import { describe, expect, it } from 'vitest';
import { gerarTabelaHtml, GerarTabelaOptions } from './DocumentoTableModal';

const baseOptions: GerarTabelaOptions = {
  rows: 3,
  cols: 2,
  estilo: 'grade-visivel',
  temCabecalho: true,
  largura100: true,
  alturaLinha: 0,
  espacamento: 'normal',
};

describe('gerarTabelaHtml', () => {
  it('gera o número de linhas e colunas pedido', () => {
    const html = gerarTabelaHtml({ ...baseOptions, rows: 4, cols: 3 });
    expect((html.match(/<tr/g) || []).length).toBe(5); // 1 cabeçalho + 4 linhas de corpo
    expect((html.match(/<th /g) || []).length).toBe(3);
    expect((html.match(/<td/g) || []).length).toBe(12); // 4 linhas x 3 colunas
  });

  it('limita linhas e colunas a um intervalo razoável mesmo com valores fora da faixa', () => {
    const html = gerarTabelaHtml({ ...baseOptions, rows: 999, cols: 999 });
    expect((html.match(/<tr/g) || []).length).toBe(21); // 1 cabeçalho + 20 linhas (máximo)
    expect((html.match(/<th /g) || []).length).toBe(8); // 8 colunas (máximo)

    const htmlMinimo = gerarTabelaHtml({ ...baseOptions, rows: 0, cols: -5 });
    expect((htmlMinimo.match(/<tr/g) || []).length).toBe(2); // 1 cabeçalho + 1 linha (mínimo)
    expect((htmlMinimo.match(/<th /g) || []).length).toBe(1); // 1 coluna (mínimo)
  });

  it('omite o <thead> quando temCabecalho é falso', () => {
    const html = gerarTabelaHtml({ ...baseOptions, temCabecalho: false });
    expect(html).not.toContain('<thead>');
    expect(html).not.toContain('<th');
  });

  it('remove as bordas quando o estilo é "grade-oculta"', () => {
    const html = gerarTabelaHtml({ ...baseOptions, estilo: 'grade-oculta' });
    expect(html).toContain('tabela-sem-grade');
    expect(html).toContain('border: none;');
    expect(html).not.toContain('border: 1px solid');
  });

  it('aplica a altura de linha em cada <tr> quando definida, e nenhuma quando "automática" (0)', () => {
    const comAltura = gerarTabelaHtml({ ...baseOptions, alturaLinha: 40 });
    const trs = comAltura.match(/<tr[^>]*>/g) || [];
    expect(trs.every(tr => tr.includes('height: 40px;'))).toBe(true);

    const semAltura = gerarTabelaHtml({ ...baseOptions, alturaLinha: 0 });
    expect(semAltura).not.toContain('height:');
  });

  it('usa o padding correspondente ao espaçamento escolhido', () => {
    expect(gerarTabelaHtml({ ...baseOptions, espacamento: 'compacto' })).toContain('padding: 4px 8px;');
    expect(gerarTabelaHtml({ ...baseOptions, espacamento: 'espacoso' })).toContain('padding: 14px 16px;');
  });

  it('usa largura automática (não 100%) quando largura100 é falso', () => {
    const html = gerarTabelaHtml({ ...baseOptions, largura100: false });
    expect(html).toContain('width: auto;');
  });
});
