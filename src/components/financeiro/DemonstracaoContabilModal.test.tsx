import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { DemonstracaoContabilModal } from './DemonstracaoContabilModal';
import { arvoreComValores } from '../../utils/demonstracaoContabil';
import { montarArvore } from '../../utils/planoContabilTree';
import type { ContaContabil, PlanoContabil } from '../../types/planoContabil';

/**
 * Componente "orientado a props" — todo o estado vem de fora, como `AssociadoFormModal`.
 * É o caso mais barato de testar: dá para montar a árvore de verdade (as funções puras já
 * são testadas isoladas) e afirmar sobre o que a tela mostra.
 */
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn(), loading: vi.fn() } }));

const conta = (over: Partial<ContaContabil> & { id: string; codigo: string; nome: string }): ContaContabil => ({
  tenant_id: 't1',
  plano_id: 'p1',
  natureza: 'receita',
  tipo: 'analitica',
  nivel: 1,
  ativo: true,
  ...over,
});

const CONTAS: ContaContabil[] = [
  conta({ id: 'r', codigo: '3', nome: 'Receitas', tipo: 'sintetica' }),
  conta({ id: 'mens', codigo: '3.1.01', nome: 'Mensalidades de Planos', conta_pai_id: 'r' }),
  conta({ id: 'extra', codigo: '3.1.03', nome: 'Serviços Extras', conta_pai_id: 'r' }),
];

const PLANO: PlanoContabil = {
  id: 'p1', tenant_id: 't1', codigo: 'PADRAO', nome: 'Plano Padrão',
  exercicio: 2026, vigencia_inicio: '2026-01-01', ativo: true,
};

// Só Mensalidades tem movimento; Serviços Extras fica zerada de propósito.
const VALORES = new Map([['mens', { previsto: 1000, realizado: 250 }]]);

const props = () => ({
  onClose: vi.fn(),
  plano: PLANO,
  arvore: arvoreComValores(montarArvore(CONTAS), VALORES),
  resumo: {
    receita: { previsto: 1000, realizado: 250 },
    despesa: { previsto: 400, realizado: 400 },
    resultado: { previsto: 600, realizado: -150 },
  },
  foraDoExercicio: { previsto: 0, realizado: 0 },
  naoClassificado: { previsto: 0, realizado: 0 },
  empresaData: null,
  userName: 'Operador',
});

beforeEach(() => vi.clearAllMocks());

describe('DemonstracaoContabilModal', () => {
  it('mostra o exercício e o plano no cabeçalho', () => {
    render(<DemonstracaoContabilModal {...props()} />);
    expect(screen.getByText('Demonstração Contábil')).toBeTruthy();
    expect(screen.getByText(/Plano Padrão/)).toBeTruthy();
  });

  it('totaliza o grupo a partir da filha e mostra a execução', () => {
    render(<DemonstracaoContabilModal {...props()} />);
    const linha = screen.getByText('Mensalidades de Planos').closest('tr') as HTMLElement;
    expect(within(linha).getByText('R$ 250,00')).toBeTruthy();
    expect(within(linha).getByText('25%')).toBeTruthy();
  });

  it('começa filtrando as contas zeradas, e o filtro traz o plano inteiro de volta', () => {
    render(<DemonstracaoContabilModal {...props()} />);
    expect(screen.queryByText('Serviços Extras')).toBeNull();

    fireEvent.click(screen.getByLabelText(/Somente contas com movimento/i));
    expect(screen.getByText('Serviços Extras')).toBeTruthy();
  });

  it('resultado negativo aparece com o sinal, não zerado', () => {
    render(<DemonstracaoContabilModal {...props()} />);
    expect(screen.getByText('-R$ 150,00')).toBeTruthy();
  });

  it('explica os critérios na própria tela — não só no papel', () => {
    render(<DemonstracaoContabilModal {...props()} />);
    expect(screen.getByText(/pela data de vencimento/i)).toBeTruthy();
    expect(screen.getByText(/pela data da liquidação/i)).toBeTruthy();
  });

  it('avisa sobre valor fora do exercício em vez de deixá-lo sumir', () => {
    const { rerender } = render(<DemonstracaoContabilModal {...props()} />);
    expect(screen.queryByText(/Fora do exercício/)).toBeNull();

    rerender(<DemonstracaoContabilModal {...props()} foraDoExercicio={{ previsto: 500, realizado: 120 }} />);
    expect(screen.getByText(/Fora do exercício/)).toBeTruthy();
    expect(screen.getByText(/R\$ 120,00/)).toBeTruthy();
  });

  it('avisa quando o filtro escondeu tudo, dizendo como desfazer', () => {
    const semMovimento = {
      ...props(),
      arvore: arvoreComValores(montarArvore(CONTAS), new Map()),
    };
    render(<DemonstracaoContabilModal {...semMovimento} />);
    expect(screen.getByText(/Desmarque o filtro acima/i)).toBeTruthy();
  });

  it('oferece imprimir e exportar sem depender de permissão de edição', () => {
    // O relatório é leitura: quem enxerga o plano pode tirar o demonstrativo dele.
    render(<DemonstracaoContabilModal {...props()} />);
    expect(screen.getByText('Imprimir')).toBeTruthy();
    expect(screen.getByText('Exportar PDF')).toBeTruthy();
  });
});
