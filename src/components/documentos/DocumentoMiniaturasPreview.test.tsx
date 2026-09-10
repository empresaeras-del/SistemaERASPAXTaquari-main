import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { DocumentoMiniaturasPreview } from './DocumentoMiniaturasPreview';

// A miniatura recebe tudo por props e não tem hooks próprios, então dá para
// renderizar direto (mesmo padrão de AssociadoFormModal.test.tsx). O que
// interessa aqui é o enquadramento do papel: a folha desenhada tem de bater com
// a orientação do documento, como já acontece no visualizador e na impressão.
const margens = { top: 20, bottom: 20, left: 25, right: 25 };

const folhas = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>('[style*="transform"]'));

describe('DocumentoMiniaturasPreview', () => {
  it('desenha a folha em retrato por padrão, sem orientação informada', () => {
    const { container } = render(
      <DocumentoMiniaturasPreview htmlContent="<p>Oi</p>" margens={margens} />
    );
    const folha = folhas(container)[0];
    expect(folha.style.width).toBe('210mm');
    expect(folha.style.minHeight).toBe('297mm');
  });

  it('gira a folha quando o documento é paisagem', () => {
    const { container } = render(
      <DocumentoMiniaturasPreview htmlContent="<p>Oi</p>" margens={margens} orientacao="paisagem" />
    );
    const folha = folhas(container)[0];
    expect(folha.style.width).toBe('297mm');
    expect(folha.style.minHeight).toBe('210mm');
  });

  it('mantém a largura da coluna e ajusta só a altura da caixa entre as orientações', () => {
    const caixa = (orientacao: 'retrato' | 'paisagem') => {
      const { container } = render(
        <DocumentoMiniaturasPreview htmlContent="<p>Oi</p>" margens={margens} orientacao={orientacao} />
      );
      return folhas(container)[0].parentElement as HTMLElement;
    };

    // 192px é a largura antiga (`w-48`) — preservada para não mexer na coluna.
    expect(caixa('retrato').style.width).toBe('192px');
    expect(caixa('paisagem').style.width).toBe('192px');

    // 297mm × (192 / 210mm) ≈ 272px, a altura antiga (`h-68`); em paisagem, ~136px.
    expect(caixa('retrato').style.height).toBe('272px');
    expect(caixa('paisagem').style.height).toBe('136px');
  });

  it('aplica as margens do documento como padding da folha', () => {
    const { container } = render(
      <DocumentoMiniaturasPreview
        htmlContent="<p>Oi</p>"
        margens={{ top: 10, bottom: 15, left: 30, right: 5 }}
      />
    );
    expect(folhas(container)[0].style.padding).toBe('10mm 5mm 15mm 30mm');
  });

  it('desenha uma miniatura por página separada pela quebra', () => {
    const html = '<p>Um</p><div class="page-break"></div><p>Dois</p>';
    const { container } = render(
      <DocumentoMiniaturasPreview htmlContent={html} margens={margens} />
    );
    expect(folhas(container)).toHaveLength(2);
  });
});
