import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const salvar = vi.fn();
const desativar = vi.fn();
const reativar = vi.fn();

const categorias = [
  { id: '1', tenant_id: 't1', codigo: 'CONVENIOS-ASSOCIADOS', nome: 'Convenios Associados', ativo: true },
  { id: '2', tenant_id: 't1', codigo: 'TECNOLOGIA-E-SISTEMAS', nome: 'Tecnologia e Sistemas', ativo: false },
];

vi.mock('../../hooks/useCategoriasFornecedor', () => ({
  useCategoriasFornecedor: () => ({
    categorias,
    loading: false,
    error: null,
    carregar: vi.fn(),
    salvar,
    desativar,
    reativar,
  }),
}));

import { CategoriasFornecedorModal } from './CategoriasFornecedorModal';

/** Monta no aninhamento real: overlay com `backdrop-blur` do formulário de fornecedor + `<form>`. */
const montarNoAninhamentoReal = () =>
  render(
    <div className="fixed inset-0 z-50 bg-bg-base/80 backdrop-blur-sm p-4">
      <form id="fornecedor-form">
        <CategoriasFornecedorModal onClose={() => {}} />
      </form>
    </div>,
  );

beforeEach(() => {
  salvar.mockReset();
  desativar.mockReset();
  reativar.mockReset();
});

describe('CategoriasFornecedorModal', () => {
  it('vai para o document.body por portal — não fica dentro do <form> nem do overlay borrado', () => {
    // Duas armadilhas de uma vez: `<button>` sem type submeteria o formulário de fornecedor, e
    // `backdrop-filter` no ancestral vira bloco de contenção de descendentes `fixed` (a lição do
    // AlterarSenhaModal). Procurar o conteúdo no documento passaria nos dois casos — por isso o
    // teste é sobre ONDE o overlay está montado.
    montarNoAninhamentoReal();
    const titulo = screen.getByText('Categorias de Fornecedor');
    const overlay = titulo.closest('.fixed');
    expect(overlay).not.toBeNull();
    expect(overlay!.parentElement).toBe(document.body);
    expect(overlay!.closest('form')).toBeNull();
  });

  it('todo botão declara `type` — a regra que vale para componente montado dentro de formulário', () => {
    montarNoAninhamentoReal();
    const semType = [...document.querySelectorAll('button')].filter((b) => !b.getAttribute('type'));
    expect(semType).toHaveLength(0);
  });

  it('a etiqueta de desativada aparece inteira, fora do texto que trunca', () => {
    // Dentro do span truncado ela era a primeira coisa cortada — sumia justamente o que a linha
    // existe para dizer. Foi o que a foto pegou.
    montarNoAninhamentoReal();
    const etiqueta = screen.getByText('(desativada)');
    expect(etiqueta.className).toContain('shrink-0');
    expect(etiqueta.className).not.toContain('truncate');
    expect(etiqueta.closest('.truncate')).toBeNull();
  });

  it('avisa que renomear muda o nome exibido nos fornecedores daquela categoria', () => {
    // `fornecedores.categoria` não é snapshot: acompanha o nome. Dizer antes evita a surpresa.
    montarNoAninhamentoReal();
    fireEvent.click(screen.getAllByTitle('Renomear')[0]);
    const campo = screen.getByPlaceholderText('Urnas e Caixões');
    expect(screen.queryByText(/passam a exibir o nome novo/)).toBeNull();
    fireEvent.change(campo, { target: { value: 'Convênios de Associados' } });
    expect(screen.getByText(/passam a exibir o nome novo/)).toBeTruthy();
  });

  it('o código de uma categoria existente não é digitável e não muda com o nome', () => {
    montarNoAninhamentoReal();
    fireEvent.click(screen.getAllByTitle('Renomear')[0]);
    const codigo = document.querySelector('input[readonly]') as HTMLInputElement;
    expect(codigo.value).toBe('CONVENIOS-ASSOCIADOS');
    fireEvent.change(screen.getByPlaceholderText('Urnas e Caixões'), {
      target: { value: 'Outro Nome Qualquer' },
    });
    expect((document.querySelector('input[readonly]') as HTMLInputElement).value).toBe(
      'CONVENIOS-ASSOCIADOS',
    );
  });

  it('nome repetido barra o salvar em vez de esperar a violação de constraint', () => {
    montarNoAninhamentoReal();
    fireEvent.click(screen.getByText('Nova Categoria'));
    fireEvent.change(screen.getByPlaceholderText('Urnas e Caixões'), {
      target: { value: 'convenios associados' },
    });
    expect(screen.getByText('Já existe uma categoria com esse nome nesta empresa.')).toBeTruthy();
    const botaoSalvar = screen.getByText('Salvar').closest('button') as HTMLButtonElement;
    expect(botaoSalvar.disabled).toBe(true);
    fireEvent.click(botaoSalvar);
    expect(salvar).not.toHaveBeenCalled();
  });

  it('não existe excluir: a ação é desativar, e a categoria em uso continua válida', () => {
    montarNoAninhamentoReal();
    expect(screen.queryByTitle('Excluir')).toBeNull();
    fireEvent.click(screen.getAllByTitle('Desativar')[0]);
    expect(desativar).toHaveBeenCalledTimes(1);
  });
});
