import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { VisualizadorDocumentoPadraoModal } from './VisualizadorDocumentoPadraoModal';
import { DocumentoPadrao } from '../../types/documentos';

/**
 * Mesma regressão de `VisualizadorReciboModal.test.tsx`, pelo outro caminho: este
 * visualizador é renderizado dentro do `<form>` do cadastro do associado
 * (`AssociadoFormModal` → `ContratoDocumentosGenerator` → aqui). Botão sem `type`
 * dentro de `<form>` é `submit` por padrão do HTML, então clicar em qualquer coisa na
 * barra do documento — inclusive no X de fechar — salvava e fechava o cadastro.
 */
const documento: DocumentoPadrao = {
  id: 'doc-1',
  empresa_id: 'emp-1',
  nome: 'Contrato de Adesão',
  tipo: 'contrato_adesao',
  conteudo: '<p>Contrato de {{associado_nome}}</p>',
  ativo: true,
  criado_em: '2026-09-10T00:00:00Z',
  atualizado_em: '2026-09-10T00:00:00Z',
};

const renderDentroDeForm = () => {
  const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
  const utils = render(
    <form onSubmit={onSubmit}>
      <VisualizadorDocumentoPadraoModal isOpen onClose={() => {}} documento={documento} />
    </form>,
  );
  return { onSubmit, ...utils };
};

describe('VisualizadorDocumentoPadraoModal dentro de um formulário', () => {
  it('não submete o formulário só por abrir', () => {
    const { onSubmit } = renderDentroDeForm();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('todo botão declara type explicitamente', () => {
    const { container } = renderDentroDeForm();
    const semType = Array.from(container.querySelectorAll('button')).filter(
      (b) => !b.hasAttribute('type'),
    );
    expect(semType.map((b) => b.getAttribute('title') || b.textContent)).toEqual([]);
  });

  it('nenhum botão da barra submete o formulário', () => {
    const { onSubmit, container } = renderDentroDeForm();

    const botoes = Array.from(container.querySelectorAll('button'));
    expect(botoes.length).toBeGreaterThan(0);

    for (const botao of botoes) {
      const rotulo = `${botao.getAttribute('title') || ''} ${botao.textContent || ''}`;
      // Imprimir abre janela e PDF baixa arquivo — fora do que este teste observa.
      if (/imprimir|pdf/i.test(rotulo)) continue;
      fireEvent.click(botao);
    }

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
