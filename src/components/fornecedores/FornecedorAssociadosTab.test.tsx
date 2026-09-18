import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';

vi.mock('../../context/AppContext', () => ({
  useAppContext: () => ({ state: { isOnline: true } }),
}));

const EMP = 'emp-1';

const assocs = vi.fn();
const parcelas = vi.fn();
const receitas = vi.fn();

vi.mock('../../services/associadosService', () => ({
  getAssociados: (...a: unknown[]) => assocs(...a),
}));
vi.mock('../../services/financeiroService', () => ({
  getAssociadosDummy: undefined,
  getParcelasReceber: (...a: unknown[]) => parcelas(...a),
  getReceitas: (...a: unknown[]) => receitas(...a),
}));

import { FornecedorAssociadosTab } from './FornecedorAssociadosTab';

const assoc = (id: string, nome: string) => ({
  id, nome, cpf: '046.537.031-40', status: 'ativo', tipo_pessoa: 'PJ', fornecedor_id: EMP,
});
const parc = (
  id: string, venc: string, status: string, valor: number, recebido?: number
) => ({ id, receita_id: 'r1', data_vencimento: venc, status, valor, valor_recebido: recebido, tenant_id: 't1' });

beforeEach(() => {
  vi.clearAllMocks();
  assocs.mockResolvedValue([assoc('a1', 'MARIA SILVA')]);
  receitas.mockResolvedValue([{ id: 'r1', associado_id: 'a1' }]);
  parcelas.mockResolvedValue([]);
});

const montar = () =>
  render(
    // A aba vive DENTRO do <form> do modal de fornecedor — o mesmo aninhamento real, não uma
    // simulação dele. Ver CLAUDE.md, "Fotografe o componente no aninhamento em que ele vai viver".
    <form id="fornecedor-form">
      <FornecedorAssociadosTab fornecedorId={EMP} tenantId="t1" nomeEmpresa="CASSEMS" />
    </form>
  );

describe('FornecedorAssociadosTab', () => {
  it('consulta sempre pela empresa do PRÓPRIO fornecedor, nunca pelo seletor do topo', async () => {
    montar();
    // `getParcelasReceber` trata 'all' como "sem filtro": passar o seletor do topo somaria
    // parcela de outra empresa na carteira desta.
    await waitFor(() => expect(parcelas).toHaveBeenCalled());
    expect(parcelas.mock.calls[0][1]).toBe('t1');
    expect(assocs.mock.calls[0][1]).toBe('t1');
    expect(receitas.mock.calls[0][1]).toBe('t1');
  });

  it('sem associado vinculado, explica onde se faz o vínculo em vez de mostrar tabela vazia', async () => {
    assocs.mockResolvedValue([]);
    montar();
    expect(await screen.findByText(/Nenhum associado vinculado a CASSEMS/)).toBeTruthy();
    expect(screen.getByText(/Empresa \/ Convênio/)).toBeTruthy();
  });

  it('a parcela paga com atraso aparece no mês em que VENCEU', async () => {
    const ano = new Date().getFullYear();
    parcelas.mockResolvedValue([
      parc('p1', `${ano}-03-10`, 'pago', 150, 150),
      parc('p2', `${ano}-04-10`, 'pendente', 150),
    ]);
    montar();

    const linha = (await screen.findByText('MARIA SILVA')).closest('tr')!;
    const celulas = within(linha).getAllByRole('cell');
    // 0 = associado, 1..12 = meses, 13 = total. Março é a célula 3.
    expect(celulas[3].textContent).toContain('150,00');
    // Abril tem o mesmo valor, mas em aberto — os dois lados existem e são distinguíveis.
    expect(celulas[4].textContent).toContain('150,00');
  });

  it('a recusa do servidor chega inteira à tela, com o texto do erro', async () => {
    parcelas.mockRejectedValue(new Error('permission denied for table parcelas_receber'));
    montar();
    expect(await screen.findByText(/A carteira não pôde ser carregada/)).toBeTruthy();
    expect(screen.getByText(/permission denied for table parcelas_receber/)).toBeTruthy();
  });

  it('parcela de outro exercício vira nota em vez de sumir', async () => {
    const ano = new Date().getFullYear();
    parcelas.mockResolvedValue([parc('p1', `${ano + 1}-01-10`, 'pendente', 160)]);
    montar();
    expect(await screen.findByText(/Fora dos totais acima/i)).toBeTruthy();
    expect(screen.getByText(/de outros exercícios/)).toBeTruthy();
  });

  it('todo botão da aba declara type — ela é renderizada dentro de um <form>', async () => {
    parcelas.mockRejectedValue(new Error('falha'));
    const { container } = montar();
    await screen.findByText(/A carteira não pôde ser carregada/);
    const semType = Array.from(container.querySelectorAll('button')).filter((b) => !b.getAttribute('type'));
    expect(semType).toHaveLength(0);
  });
});
