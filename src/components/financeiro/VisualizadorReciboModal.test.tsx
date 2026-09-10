import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VisualizadorReciboModal, ReciboDados } from './VisualizadorReciboModal';

/**
 * Regressão: o visualizador é renderizado **dentro** do `<form>` do cadastro do
 * associado (`AssociadoFormModal` → `AssociadoMensalidadesTab` → aqui). Em HTML, um
 * `<button>` sem `type` dentro de um `<form>` vale `type="submit"` — então cada botão
 * da barra do recibo disparava o `onSubmit` do formulário do associado, que salva e
 * fecha o cadastro. O modal parecia "fechar sozinho ao abrir o documento".
 *
 * Estes testes montam exatamente essa aninhagem e cobram que nenhum clique dentro do
 * visualizador submeta o formulário de fora.
 */
const dados: ReciboDados = {
  numRecibo: '0001',
  tipo: 'recebimento',
  pagadorNome: 'MARIA DA SILVA',
  descricao: 'Mensalidade 1/12',
  dataLiquidacao: '2026-09-10',
  formaPagamento: 'BOLETO',
  valor: 64,
};

const renderDentroDeForm = () => {
  const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
  const utils = render(
    <form onSubmit={onSubmit}>
      <VisualizadorReciboModal isOpen onClose={() => {}} dados={dados} empresaData={null} />
    </form>,
  );
  return { onSubmit, ...utils };
};

describe('VisualizadorReciboModal dentro de um formulário', () => {
  it('não submete o formulário só por abrir', () => {
    const { onSubmit } = renderDentroDeForm();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('nenhum botão da barra de ferramentas submete o formulário', () => {
    const { onSubmit, container } = renderDentroDeForm();

    const botoes = Array.from(container.querySelectorAll('button'));
    expect(botoes.length).toBeGreaterThan(0);

    for (const botao of botoes) {
      // Só os que não disparam efeito externo (imprimir abre janela, PDF baixa arquivo).
      const rotulo = `${botao.getAttribute('title') || ''} ${botao.textContent || ''}`;
      if (/imprimir|pdf/i.test(rotulo)) continue;
      fireEvent.click(botao);
    }

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('todo botão declara type explicitamente', () => {
    // A causa-raiz em uma asserção: sem `type`, o HTML assume `submit`.
    const { container } = renderDentroDeForm();
    const semType = Array.from(container.querySelectorAll('button')).filter(
      (b) => !b.hasAttribute('type'),
    );
    expect(semType.map((b) => b.getAttribute('title') || b.textContent)).toEqual([]);
  });

  it('o zoom continua funcionando depois da correção', () => {
    renderDentroDeForm();
    const ampliar = screen.getByTitle(/ampliar zoom/i);
    fireEvent.click(ampliar);
    expect(screen.getByTitle(/resetar para 100%/i).textContent).not.toContain('100');
  });
});
