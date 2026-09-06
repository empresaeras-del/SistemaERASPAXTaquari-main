import { describe, it, expect } from 'vitest';
import { gerarCssImpressaoDocumento, montarHtmlImpressaoDocumento } from './documentoPrintStyles';

describe('gerarCssImpressaoDocumento', () => {
  it('usa 15mm em todos os lados quando o documento não tem margens', () => {
    expect(gerarCssImpressaoDocumento('portrait')).toContain('margin: 15mm 15mm 15mm 15mm;');
  });

  it('usa as margens do documento, na ordem top/right/bottom/left do CSS', () => {
    const css = gerarCssImpressaoDocumento('portrait', { top: 20, bottom: 18, left: 25, right: 12 });
    expect(css).toContain('margin: 20mm 12mm 18mm 25mm;');
  });

  it('leva a orientação para o @page', () => {
    expect(gerarCssImpressaoDocumento('landscape')).toContain('size: A4 landscape;');
  });

  it('ancora a assinatura de posição livre no container', () => {
    // Sem este `relative`, o `position: absolute` da assinatura é resolvido
    // contra a caixa da página em vez do fluxo do documento.
    const css = gerarCssImpressaoDocumento();
    expect(css).toMatch(/\.doc-container\s*\{[^}]*position:\s*relative/);
  });

  it('limita a imagem da assinatura, que na impressão não tem Tailwind', () => {
    const css = gerarCssImpressaoDocumento();
    expect(css).toMatch(/\.doc-assinatura-livre img\s*\{[^}]*max-width:\s*100%/);
    expect(css).toMatch(/\.doc-assinatura-livre img\s*\{[^}]*max-height:\s*100%/);
  });

  it('esconde as guias de página, que só servem ao visualizador', () => {
    expect(gerarCssImpressaoDocumento()).toMatch(/\.doc-guia-pagina\s*\{[^}]*display:\s*none/);
  });
});

describe('montarHtmlImpressaoDocumento', () => {
  it('repassa margens e orientação para o CSS', () => {
    const html = montarHtmlImpressaoDocumento('T', '<p>x</p>', 'landscape', {
      top: 10, bottom: 10, left: 30, right: 30,
    });
    expect(html).toContain('margin: 10mm 30mm 10mm 30mm;');
    expect(html).toContain('size: A4 landscape;');
  });

  it('embrulha o corpo no container do documento', () => {
    expect(montarHtmlImpressaoDocumento('T', '<p>corpo</p>')).toContain('<div class="doc-container">');
  });
});
