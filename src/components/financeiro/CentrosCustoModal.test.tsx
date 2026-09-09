import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CentrosCustoModal } from './CentrosCustoModal';
import type { CentroCusto } from '../../types/centroCusto';

/**
 * Ao contrário de `AssociadoFormModal`, este componente tem hook próprio: ele chama
 * `useCentrosCusto` por dentro, de propósito (é um gerenciador que precisa recarregar a lista
 * depois de gravar). Então o teste mocka o hook, e não o contexto inteiro — é o mesmo
 * princípio dos testes de service, onde se mocka a borda (`../lib/idb`) em vez de subir a
 * infraestrutura de verdade.
 */
const salvar = vi.fn().mockResolvedValue({});
const desativar = vi.fn().mockResolvedValue(undefined);
const reativar = vi.fn().mockResolvedValue(undefined);

let centrosMock: CentroCusto[] = [];
let loadingMock = false;

vi.mock('../../hooks/useCentrosCusto', () => ({
  useCentrosCusto: () => ({
    centros: centrosMock,
    loading: loadingMock,
    error: null,
    carregar: vi.fn(),
    salvar,
    desativar,
    reativar,
  }),
}));

const centro = (over: Partial<CentroCusto> & { id: string; codigo: string; nome: string }): CentroCusto => ({
  tenant_id: 't1',
  ativo: true,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  loadingMock = false;
  centrosMock = [
    centro({ id: 'c1', codigo: 'ADMINISTRATIVO', nome: 'Administrativo' }),
    centro({ id: 'c2', codigo: 'FUNERARIA', nome: 'Funerária', ativo: false }),
  ];
});

describe('CentrosCustoModal', () => {
  it('lista os centros da empresa, marcando o desativado', () => {
    render(<CentrosCustoModal onClose={vi.fn()} />);
    expect(screen.getByText('ADMINISTRATIVO')).toBeTruthy();
    expect(screen.getByText(/Funerária/)).toBeTruthy();
    expect(screen.getByText('(desativado)')).toBeTruthy();
  });

  it('avisa quando a empresa ainda não tem nenhum centro', () => {
    centrosMock = [];
    render(<CentrosCustoModal onClose={vi.fn()} />);
    expect(screen.getByText(/ainda não tem nenhum centro de custo/i)).toBeTruthy();
  });

  it('gera o código a partir do nome digitado, sem deixar editar', () => {
    render(<CentrosCustoModal onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Novo Centro de Custo'));

    const nome = screen.getByPlaceholderText('Rede Assistencial') as HTMLInputElement;
    fireEvent.change(nome, { target: { value: 'Comercial / Vendas' } });

    const codigo = screen.getByTitle('Gerado a partir do nome.') as HTMLInputElement;
    expect(codigo.value).toBe('COMERCIAL-VENDAS');
    expect(codigo.readOnly).toBe(true);
  });

  it('barra nome repetido antes de chamar o service', () => {
    render(<CentrosCustoModal onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Novo Centro de Custo'));
    fireEvent.change(screen.getByPlaceholderText('Rede Assistencial'), {
      target: { value: '  administrativo  ' }, // espaço e caixa diferentes: mesmo nome
    });

    expect(screen.getByText(/Já existe um centro de custo com esse nome/i)).toBeTruthy();
    fireEvent.click(screen.getByText('Salvar'));
    expect(salvar).not.toHaveBeenCalled();
  });

  it('ao editar, mantém o código existente em vez de regerar pelo nome novo', () => {
    render(<CentrosCustoModal onClose={vi.fn()} />);
    fireEvent.click(screen.getAllByTitle('Editar')[0]);

    const codigo = screen.getByTitle('O código de um centro existente não muda.') as HTMLInputElement;
    expect(codigo.value).toBe('ADMINISTRATIVO');

    fireEvent.change(screen.getByPlaceholderText('Rede Assistencial'), {
      target: { value: 'Administração Geral' },
    });
    expect(codigo.value).toBe('ADMINISTRATIVO');
  });

  it('desativa o centro ativo e reativa o desativado', () => {
    render(<CentrosCustoModal onClose={vi.fn()} />);
    fireEvent.click(screen.getByTitle('Desativar'));
    expect(desativar).toHaveBeenCalledWith(expect.objectContaining({ id: 'c1' }));

    fireEvent.click(screen.getByTitle('Reativar'));
    expect(reativar).toHaveBeenCalledWith(expect.objectContaining({ id: 'c2' }));
  });

  it('sem permissão de edição, não oferece cadastrar nem alterar', () => {
    render(<CentrosCustoModal onClose={vi.fn()} podeEditar={false} />);
    expect(screen.queryByText('Novo Centro de Custo')).toBeNull();
    expect(screen.queryByTitle('Editar')).toBeNull();
    expect(screen.queryByTitle('Desativar')).toBeNull();
  });
});
