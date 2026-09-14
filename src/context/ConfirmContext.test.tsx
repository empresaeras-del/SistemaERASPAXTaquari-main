import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmProvider, useConfirm } from './ConfirmContext';

/** Abre o diálogo com as opções dadas assim que monta. */
const Abridor: React.FC<{ opcoes: Parameters<ReturnType<typeof useConfirm>['confirm']>[0] }> = ({ opcoes }) => {
  const { confirm } = useConfirm();
  return (
    <button type="button" onClick={() => confirm(opcoes)}>
      abrir
    </button>
  );
};

const abrir = (opcoes: any) => {
  render(
    <ConfirmProvider>
      <Abridor opcoes={opcoes} />
    </ConfirmProvider>,
  );
  fireEvent.click(screen.getByText('abrir'));
};

describe('ConfirmContext', () => {
  it('mostra o resumo do que será criado, com rótulo e valor', () => {
    // É o ponto da mudança: para responder "deseja gerar a cobrança?" o operador
    // precisa ver valor e vencimento, não um parágrafo.
    abrir({
      title: 'Gerar cobrança?',
      message: 'Deseja gerar a conta a receber abaixo?',
      resumo: [
        { rotulo: 'Valor', valor: 'R$ 800,00', destaque: true },
        { rotulo: 'Vencimento', valor: '13/09/2026' },
        { rotulo: 'Devedor', valor: 'MARIA DA SILVA' },
      ],
      onConfirm: () => {},
    });

    expect(screen.getByText('Valor')).toBeTruthy();
    expect(screen.getByText('R$ 800,00')).toBeTruthy();
    expect(screen.getByText('Vencimento')).toBeTruthy();
    expect(screen.getByText('13/09/2026')).toBeTruthy();
    expect(screen.getByText('MARIA DA SILVA')).toBeTruthy();
  });

  it('exibe o aviso de cobrança anterior junto do resumo', () => {
    abrir({
      title: 'Gerar cobrança?',
      message: 'Deseja gerar?',
      resumo: [{ rotulo: 'Valor', valor: 'R$ 120,00' }],
      aviso: 'Atenção: esta guia já gerou uma cobrança de R$ 120,00.',
      onConfirm: () => {},
    });

    expect(screen.getByText(/já gerou uma cobrança/)).toBeTruthy();
  });

  it('sem resumo, o diálogo antigo continua igual', () => {
    // Todos os outros chamadores do projeto passam só title/message: a mudança não
    // pode alterar o que eles mostram.
    abrir({
      title: 'Excluir Parcela',
      message: 'Deseja realmente excluir?',
      confirmText: 'Excluir',
      onConfirm: () => {},
    });

    expect(screen.getByText('Excluir Parcela')).toBeTruthy();
    expect(screen.getByText('Deseja realmente excluir?')).toBeTruthy();
    expect(screen.queryByText('Vencimento')).toBeNull();
  });

  it('o aviso só aparece acompanhado do resumo', () => {
    // O aviso vive dentro do bloco do resumo; sem resumo não há onde pendurá-lo, e
    // deixar isso implícito faria um chamador achar que mandou um aviso que some.
    abrir({
      title: 'Confirmar',
      message: 'Mensagem',
      aviso: 'aviso solto',
      onConfirm: () => {},
    });

    expect(screen.queryByText('aviso solto')).toBeNull();
  });

  it('cancelar executa o onCancel e fecha', async () => {
    const onCancel = vi.fn();
    abrir({
      title: 'Gerar cobrança?',
      message: 'Deseja gerar?',
      cancelText: 'Não gerar',
      resumo: [{ rotulo: 'Valor', valor: 'R$ 10,00' }],
      onConfirm: () => {},
      onCancel,
    });

    fireEvent.click(screen.getByText('Não gerar'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
