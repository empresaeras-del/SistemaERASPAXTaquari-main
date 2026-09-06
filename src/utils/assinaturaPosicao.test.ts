import { describe, it, expect } from 'vitest';
import {
  MARGEM_PAGINA_MM,
  alturaUtilMm,
  larguraUtilMm,
  pxPorMm,
  decomporEmPagina,
  deslocamentoContinuoMm,
  configDeArrasto,
  converterLegado,
  normalizarConfig,
  estiloAssinaturaMm,
  configEmPx,
  configPadrao,
  totalPaginasDaFolha,
  margensOu,
  MARGENS_PADRAO,
} from './assinaturaPosicao';
import type { AssinaturaConfigV1, AssinaturaConfigV2 } from '../types/documentos';

/** 210mm de folha renderizados em 794px ≈ a largura A4 a 96dpi. */
const ESCALA = 794 / 210;

describe('dimensões da área útil', () => {
  it('desconta as duas margens do papel em retrato', () => {
    expect(larguraUtilMm('retrato')).toBe(210 - MARGEM_PAGINA_MM * 2);
    expect(alturaUtilMm('retrato')).toBe(297 - MARGEM_PAGINA_MM * 2);
  });

  it('troca largura e altura em paisagem', () => {
    expect(larguraUtilMm('paisagem')).toBe(297 - MARGEM_PAGINA_MM * 2);
    expect(alturaUtilMm('paisagem')).toBe(210 - MARGEM_PAGINA_MM * 2);
  });

  it('aceita os nomes em inglês usados pelo visualizador', () => {
    expect(alturaUtilMm('portrait')).toBe(alturaUtilMm('retrato'));
    expect(alturaUtilMm('landscape')).toBe(alturaUtilMm('paisagem'));
  });
});

describe('pxPorMm', () => {
  it('deriva a escala da largura renderizada da folha', () => {
    expect(pxPorMm(794, 'retrato')).toBeCloseTo(794 / 210, 6);
  });

  it('usa a largura maior em paisagem', () => {
    expect(pxPorMm(1122, 'paisagem')).toBeCloseTo(1122 / 297, 6);
  });

  it('devolve 0 quando a folha ainda não foi medida', () => {
    expect(pxPorMm(0, 'retrato')).toBe(0);
    expect(pxPorMm(-10, 'retrato')).toBe(0);
  });
});

describe('decomporEmPagina', () => {
  const passo = alturaUtilMm('retrato'); // 267

  it('mantém na primeira página o que cabe nela', () => {
    expect(decomporEmPagina(200, 'retrato')).toEqual({ pagina: 0, yMm: 200 });
  });

  it('leva para a página seguinte o que passa do limite', () => {
    const r = decomporEmPagina(passo + 30, 'retrato');
    expect(r.pagina).toBe(1);
    expect(r.yMm).toBeCloseTo(30, 6);
  });

  it('coloca o limite exato no topo da página seguinte', () => {
    expect(decomporEmPagina(passo, 'retrato')).toEqual({ pagina: 1, yMm: 0 });
  });

  it('trata deslocamento negativo como topo da primeira página', () => {
    expect(decomporEmPagina(-50, 'retrato')).toEqual({ pagina: 0, yMm: 0 });
  });

  it('é o inverso de deslocamentoContinuoMm', () => {
    const alvo = 3 * passo + 42;
    const { pagina, yMm } = decomporEmPagina(alvo, 'retrato');
    const volta = deslocamentoContinuoMm(
      { versao: 2, pagina, yMm, xMm: 0, larguraMm: 1, alturaMm: 1 },
      'retrato',
    );
    expect(volta).toBeCloseTo(alvo, 6);
  });
});

describe('configDeArrasto', () => {
  it('converte pixels em milímetros e deriva a página', () => {
    const passoPx = alturaUtilMm('retrato') * ESCALA;
    const cfg = configDeArrasto(100 * ESCALA, passoPx + 40 * ESCALA, 70 * ESCALA, 30 * ESCALA, ESCALA, 'retrato');
    expect(cfg).not.toBeNull();
    expect(cfg!.versao).toBe(2);
    expect(cfg!.pagina).toBe(1);
    expect(cfg!.xMm).toBeCloseTo(100, 4);
    expect(cfg!.yMm).toBeCloseTo(40, 4);
    expect(cfg!.larguraMm).toBeCloseTo(70, 4);
    expect(cfg!.alturaMm).toBeCloseTo(30, 4);
  });

  it('não deixa a assinatura sair pela esquerda nem sumir de tamanho', () => {
    const cfg = configDeArrasto(-80, 10, 0, 0, ESCALA, 'retrato');
    expect(cfg!.xMm).toBe(0);
    expect(cfg!.larguraMm).toBe(1);
    expect(cfg!.alturaMm).toBe(1);
  });

  it('devolve null quando a folha ainda não foi medida', () => {
    expect(configDeArrasto(10, 10, 10, 10, 0, 'retrato')).toBeNull();
  });
});

describe('converterLegado', () => {
  // Reproduz o registro real de produção do "Contrato de Adesao": a folha
  // contínua tinha ~7 páginas de altura quando o usuário arrastou a assinatura.
  const legado: AssinaturaConfigV1 = {
    x: 62.959716181911205,
    y: 13.332344461920883,
    largura: 16.876574307304786,
    altura: 2.0269119400442857,
    pagina: 0,
  };
  const medidas = {
    larguraFolhaPx: 794,
    alturaFolhaPx: 7 * 297 * ESCALA, // folha de ~7 páginas
    paddingTopPx: 22 * ESCALA,
    paddingEsquerdaPx: 20 * ESCALA,
  };

  it('recupera a posição que o usuário via na tela, e não a que era impressa', () => {
    const cfg = converterLegado(legado, medidas, 'retrato')!;
    // 13,33% de ~2079mm de folha ≈ 277mm da borda, menos 22mm de padding ≈ 255mm
    // de área útil — ou seja, já na segunda página (passo de 267mm)... calculado
    // exatamente abaixo, sem arredondar na mão.
    const deslocamentoEsperado = (legado.y / 100) * 7 * 297 - 22;
    expect(deslocamentoContinuoMm(cfg, 'retrato')).toBeCloseTo(deslocamentoEsperado, 3);
  });

  it('converte a altura contra a folha inteira, não contra uma página', () => {
    const cfg = converterLegado(legado, medidas, 'retrato')!;
    // É esta a conta que a impressão errava: 2,03% de 267mm dava 5,4mm.
    expect(cfg.alturaMm).toBeCloseTo((legado.altura / 100) * 7 * 297, 3);
    expect(cfg.alturaMm).toBeGreaterThan(30);
  });

  it('desconta o padding lateral da folha na coordenada horizontal', () => {
    const cfg = converterLegado(legado, medidas, 'retrato')!;
    expect(cfg.xMm).toBeCloseTo((legado.x / 100) * 210 - 20, 3);
  });

  it('devolve null quando a folha ainda não foi medida', () => {
    expect(converterLegado(legado, { ...medidas, larguraFolhaPx: 0 }, 'retrato')).toBeNull();
  });
});

describe('normalizarConfig', () => {
  const medidas = {
    larguraFolhaPx: 794,
    alturaFolhaPx: 297 * ESCALA,
    paddingTopPx: 22 * ESCALA,
    paddingEsquerdaPx: 20 * ESCALA,
  };

  it('devolve intacto o que já está no formato atual', () => {
    const v2: AssinaturaConfigV2 = { versao: 2, pagina: 2, xMm: 10, yMm: 20, larguraMm: 30, alturaMm: 40 };
    expect(normalizarConfig(v2, medidas, 'retrato')).toBe(v2);
  });

  it('converte o formato legado', () => {
    const v1: AssinaturaConfigV1 = { x: 30, y: 50, largura: 20, altura: 10, pagina: 0 };
    const cfg = normalizarConfig(v1, medidas, 'retrato')!;
    expect(cfg.versao).toBe(2);
  });

  it('passa null e undefined adiante', () => {
    expect(normalizarConfig(null, medidas, 'retrato')).toBeNull();
    expect(normalizarConfig(undefined, medidas, 'retrato')).toBeNull();
  });
});

describe('estiloAssinaturaMm', () => {
  it('emite milímetros somando as páginas anteriores ao deslocamento', () => {
    const cfg: AssinaturaConfigV2 = { versao: 2, pagina: 2, xMm: 55, yMm: 200, larguraMm: 70, alturaMm: 32 };
    expect(estiloAssinaturaMm(cfg, 'retrato')).toEqual({
      left: '55.00mm',
      top: `${(2 * 267 + 200).toFixed(2)}mm`,
      width: '70.00mm',
      height: '32.00mm',
    });
  });
});

describe('configEmPx', () => {
  it('é a volta exata de configDeArrasto', () => {
    const original = configDeArrasto(120 * ESCALA, 500 * ESCALA, 70 * ESCALA, 32 * ESCALA, ESCALA, 'retrato')!;
    const px = configEmPx(original, ESCALA, 'retrato');
    expect(px.x).toBeCloseTo(120 * ESCALA, 3);
    expect(px.y).toBeCloseTo(500 * ESCALA, 3);
    expect(px.largura).toBeCloseTo(70 * ESCALA, 3);
    expect(px.altura).toBeCloseTo(32 * ESCALA, 3);
  });
});

describe('configPadrao', () => {
  it('sugere o rodapé da última página que o documento ocupa', () => {
    const cfg = configPadrao(7 * alturaUtilMm('retrato'), 'retrato');
    expect(cfg.pagina).toBe(6);
    expect(cfg.yMm).toBeCloseTo(267 - 32 - 12, 6);
  });

  it('cai na primeira página quando o documento tem só uma', () => {
    expect(configPadrao(100, 'retrato').pagina).toBe(0);
  });

  it('centraliza horizontalmente na área útil', () => {
    const cfg = configPadrao(100, 'retrato');
    expect(cfg.xMm).toBeCloseTo((180 - 70) / 2, 6);
  });
});

describe('totalPaginasDaFolha', () => {
  it('nunca devolve menos de uma página', () => {
    expect(totalPaginasDaFolha(0, 'retrato')).toBe(1);
    expect(totalPaginasDaFolha(10, 'retrato')).toBe(1);
  });

  it('arredonda para cima o que transborda', () => {
    expect(totalPaginasDaFolha(267, 'retrato')).toBe(1);
    expect(totalPaginasDaFolha(268, 'retrato')).toBe(2);
    expect(totalPaginasDaFolha(7 * 267, 'retrato')).toBe(7);
  });
});

describe('margensOu', () => {
  it('cai no padrão de 15mm quando o documento não tem margens gravadas', () => {
    expect(margensOu(null)).toEqual(MARGENS_PADRAO);
    expect(margensOu(undefined)).toEqual(MARGENS_PADRAO);
  });

  it('preserva as margens do documento', () => {
    const m = { top: 20, bottom: 20, left: 25, right: 25 };
    expect(margensOu(m)).toEqual(m);
  });

  it('completa lado a lado o que vier inválido do JSONB', () => {
    // O banco guarda um jsonb livre: um registro antigo pode ter só alguns lados.
    const parcial = { top: 30, bottom: NaN, left: 10 } as unknown as typeof MARGENS_PADRAO;
    expect(margensOu(parcial)).toEqual({ top: 30, bottom: 15, left: 10, right: 15 });
  });
});

describe('área útil com margens do documento', () => {
  const largas = { top: 25.4, bottom: 25.4, left: 35, right: 35 };

  it('desconta as margens reais, não a constante', () => {
    expect(larguraUtilMm('retrato', largas)).toBeCloseTo(210 - 70, 6);
    expect(alturaUtilMm('retrato', largas)).toBeCloseTo(297 - 50.8, 6);
  });

  it('muda o passo de página, e com ele a decomposição', () => {
    const passo = alturaUtilMm('retrato', largas); // 246,2mm
    const r = decomporEmPagina(passo + 10, 'retrato', largas);
    expect(r.pagina).toBe(1);
    expect(r.yMm).toBeCloseTo(10, 6);
    // Com as margens padrão (passo 267mm) o mesmo deslocamento ainda seria a página 0.
    expect(decomporEmPagina(passo + 10, 'retrato').pagina).toBe(0);
  });

  it('mantém a assinatura no mesmo ponto da página quando as margens mudam', () => {
    // yMm é medido a partir do topo da área útil, então a posição relativa à
    // página não depende da margem — só o deslocamento contínuo muda.
    const cfg = { versao: 2 as const, pagina: 2, xMm: 40, yMm: 100, larguraMm: 70, alturaMm: 32 };
    expect(deslocamentoContinuoMm(cfg, 'retrato')).toBeCloseTo(2 * 267 + 100, 6);
    expect(deslocamentoContinuoMm(cfg, 'retrato', largas)).toBeCloseTo(2 * 246.2 + 100, 6);
  });

  it('centraliza a sugestão padrão na área útil real', () => {
    const cfg = configPadrao(100, 'retrato', largas);
    expect(cfg.xMm).toBeCloseTo((140 - 70) / 2, 6);
  });

  it('conta as páginas da folha com o passo das margens do documento', () => {
    expect(totalPaginasDaFolha(500, 'retrato', largas)).toBe(3); // 500 / 246,2
    expect(totalPaginasDaFolha(500, 'retrato')).toBe(2); // 500 / 267
  });
});
