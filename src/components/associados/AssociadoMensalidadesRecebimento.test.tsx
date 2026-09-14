import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('../../context/AppContext', () => ({
  useAppContext: () => ({
    state: { isOnline: true, user: { nome: 'EDSON RENIS', nivel: 'admin', id: 'u1' }, empresaSelecionada: 't1' },
  }),
}));
vi.mock('../../context/ToastContext', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));
vi.mock('../../context/ConfirmContext', () => ({ useConfirm: () => ({ confirm: vi.fn() }) }));
vi.mock('../../hooks/useSeletorPlanoPax', () => ({ useSeletorPlanoPax: () => ({ planos: [], loading: false }) }));

const parcela = {
  id: 'eb5ce46f-4b42-4cc2-a910-233d40b3b5af',
  receita_id: '22222222-2222-4222-8222-222222222222',
  numero_parcela: 2, total_parcelas: 12, descricao: 'Mensalidade 2/12 - PLANO TESTE',
  status: 'pendente', valor: 60, data_vencimento: '2026-10-10', forma_pagamento: 'boleto',
  devedor_nome: 'EDSON RENIS ALVES DA SILVA', devedor_cpf_cnpj: '01798921189',
  tipo_devedor: 'associado', tenant_id: 't1',
};

vi.mock('../../services/financeiroService', () => ({
  getReceitas: vi.fn(async () => [
    { id: '22222222-2222-4222-8222-222222222222', associado_id: 'a1', tenant_id: 't1', descricao: 'Contrato', status: 'ativo' },
  ]),
  getParcelasReceber: vi.fn(async () => [parcela]),
  salvarReceita: vi.fn(), atualizarReceita: vi.fn(), atualizarParcelaReceber: vi.fn(),
  excluirReceita: vi.fn(), excluirParcelaReceber: vi.fn(),
  registrarRecebimento: vi.fn(async () => {}),
}));
vi.mock('../../services/caixasService', () => ({
  getLoteAbertoAtivo: vi.fn(async () => ({ id: 'l1', codigo_lote: 'LOTE-1', operador_nome: 'OP', terminal_caixa: 'T1' })),
  registrarMovimentacao: vi.fn(async () => {}),
}));
vi.mock('../../services/contasBancariasService', () => ({ getContasBancariasAtivas: vi.fn(async () => []) }));
vi.mock('../../services/empresasService', () => ({ getEmpresaById: vi.fn(async () => ({ id: 't1', nome_fantasia: 'ERAS' })) }));
vi.mock('../../lib/supabase', () => ({ registrarAuditoria: vi.fn() }));

import { registrarMovimentacao } from '../../services/caixasService';
import { registrarRecebimento } from '../../services/financeiroService';
import { AssociadoMensalidadesTab } from './AssociadoMensalidadesTab';

const associado = {
  id: 'a1', nome: 'EDSON RENIS ALVES DA SILVA', cpf: '01798921189',
  status: 'ativo', tenant_id: 't1', plano_nome: 'PLANO TESTE', dependentes: [],
} as any;

/** Monta a aba dentro do `<form>` do cadastro, como o AssociadoFormModal faz de verdade. */
const montarDentroDoCadastro = (onSubmitDoCadastro: () => void) =>
  render(
    <form
      id="associado-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (e.target !== e.currentTarget && (e.target as HTMLElement)?.id !== 'associado-form') return;
        onSubmitDoCadastro();
      }}
    >
      <AssociadoMensalidadesTab associado={associado} />
    </form>,
  );

const efetivarRecebimento = async () => {
  await userEvent.click(await screen.findByRole('button', { name: /Receber/ }));
  await userEvent.click(await screen.findByRole('button', { name: /Avançar/ }));
  await userEvent.click(await screen.findByRole('button', { name: /Confirmar e Efetivar Baixa/ }));
};

beforeEach(() => vi.clearAllMocks());

describe('recebimento de parcela no cadastro do associado', () => {
  it('não existe <form> dentro de <form> — o modal não é mais aninhado', async () => {
    montarDentroDoCadastro(vi.fn());
    await userEvent.click(await screen.findByRole('button', { name: /Receber/ }));
    expect(document.querySelectorAll('form form')).toHaveLength(0);
  });

  it('efetivar a baixa não submete nem fecha o cadastro do associado', async () => {
    const salvarCadastro = vi.fn();
    montarDentroDoCadastro(salvarCadastro);
    await efetivarRecebimento();

    expect(vi.mocked(registrarRecebimento)).toHaveBeenCalledTimes(1);
    expect(salvarCadastro).not.toHaveBeenCalled();
  });

  it('ao concluir, o recibo abre sozinho com o que acabou de ser recebido', async () => {
    // Sem isto o recebimento termina sem documento nenhum, e o operador precisa lembrar
    // de achar a linha certa e clicar em "Recibo" para entregar o comprovante.
    montarDentroDoCadastro(vi.fn());
    await efetivarRecebimento();

    // O número do recibo é derivado do id da parcela, então achá-lo na tela prova que o
    // comprovante aberto é o DESTA parcela, não um modal genérico.
    expect((await screen.findAllByText(/EB5CE46F/)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Mensalidade 2\/12 - PLANO TESTE/).length).toBeGreaterThan(0);
  });

  it('a movimentação de caixa nasce com a empresa resolvida, nunca com um tenant inventado', async () => {
    montarDentroDoCadastro(vi.fn());
    await efetivarRecebimento();

    const [, movimentacao] = vi.mocked(registrarMovimentacao).mock.calls[0] as any[];
    expect(movimentacao.tenant_id).toBe('t1');
    expect(movimentacao.valor).toBe(60);
    // A baixa, a movimentação e o recibo saem do mesmo instante.
    const [, , dadosBaixa] = vi.mocked(registrarRecebimento).mock.calls[0] as any[];
    expect(movimentacao.data_movimentacao).toBe(dadosBaixa.data_recebimento);
  });
});
