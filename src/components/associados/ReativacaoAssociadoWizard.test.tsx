import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react';

/**
 * Terceiro teste de render do projeto, e o primeiro de um componente com hooks próprios.
 *
 * O que ele trava é a etapa 2 da reativação: incluir um dependente ali tem de mexer no
 * **valor do contrato** na mesma hora, e a única forma de conferir isso sem navegador é
 * montar o assistente de verdade e clicar. Os hooks de dados são mockados (planos,
 * documentos, empresas, contexto) — o que está sob teste é a tela, não eles.
 */

vi.mock('../../context/AppContext', () => ({
  useAppContext: () => ({
    state: { isOnline: true, empresaSelecionada: 'emp-1', user: { id: 'u1', tenant_id: 'emp-1' } },
  }),
}));
vi.mock('../../context/ToastContext', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));
vi.mock('../../hooks/usePlanosPax', () => ({
  usePlanosPax: () => ({
    planosAtivos: [{ id: 'p1', nome: 'Plano Ouro', valor_mensalidade: 100 }],
    planos: [{ id: 'p1', nome: 'Plano Ouro', valor_mensalidade: 100, tipo_plano: 'individual' }],
    // Espelha o cálculo real de plano individual: o valor acompanha o número de vidas.
    calcularValor: (_p: any, vidas = 1) => ({
      base: 100 * vidas,
      por_vida: 100,
      total: 100 * vidas,
      descricao: '',
    }),
  }),
}));
vi.mock('../../hooks/useDocumentosPadroes', () => ({
  useDocumentosPadroes: () => ({ documentos: [], loading: false }),
}));
vi.mock('../../services/empresasService', () => ({
  getEmpresas: async () => [],
  getEmpresaById: async () => null,
}));
vi.mock('../documentos/VisualizadorDocumentoPadraoModal', () => ({
  VisualizadorDocumentoPadraoModal: () => null,
}));
vi.mock('../../services/reativacaoService', () => ({
  reativarAssociadoComNovoContrato: vi.fn(async (dados: any) => ({
    associado: { ...dados.associado, status: 'ativo' },
    dependentesReativados: dados.idsDependentesReativados.length,
    dependentesMantidosInativos: 0,
    contratosArquivados: 1,
    numeroContrato: dados.numeroContrato,
    receitaId: 'rec-1',
    parcelasGeradas: dados.parcelas.length,
    valorTotal: 0,
  })),
}));

import { reativarAssociadoComNovoContrato } from '../../services/reativacaoService';
import { ReativacaoAssociadoWizard } from './ReativacaoAssociadoWizard';

const associado: any = {
  id: 'a1',
  tenant_id: 'emp-1',
  nome: 'EDSON RENIS ALVES DA SILVA',
  cpf: '04653703140',
  status: 'inativo',
  data_adesao: '2020-03-01',
  plano_nome: 'Plano Prata',
  numero_contrato: 'CTR-ANTIGO1',
  dependentes: [
    {
      id: 'd1',
      nome: 'JOSIELE DE JESUS SOBRINHO',
      parentesco: 'OUTRO',
      data_nascimento: '1989-05-10',
      status: 'inativo',
    },
  ],
};

const montarNaEtapaDeDependentes = () => {
  const utils = render(
    <ReativacaoAssociadoWizard associado={associado} onClose={vi.fn()} onSuccess={vi.fn()} />,
  );
  fireEvent.click(utils.getByText('Avançar'));
  return utils;
};

/** Preenche e salva o formulário de dependente, que tem atraso próprio antes do `onSave`. */
const incluirDependente = (container: HTMLElement, nome: string, nascimento: string) => {
  const porPlaceholder = (trecho: string) =>
    container.querySelector(`input[placeholder*="${trecho}"]`) as HTMLInputElement;

  fireEvent.change(porPlaceholder('MARIA SILVA'), { target: { value: nome } });
  fireEvent.change(container.querySelector('input[type="date"]') as HTMLInputElement, {
    target: { value: nascimento },
  });
  fireEvent.change(porPlaceholder('FILHO(A)'), { target: { value: 'NETO(A)' } });

  const salvar = Array.from(container.querySelectorAll('button')).find((b) =>
    (b.textContent || '').includes('Adicionar Dependente'),
  )!;
  fireEvent.click(salvar);
  act(() => {
    vi.advanceTimersByTime(1200);
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

describe('ReativacaoAssociadoWizard — etapa de dependentes', () => {
  it('lista o dependente já cadastrado e conta o titular junto', () => {
    const { container } = montarNaEtapaDeDependentes();
    expect(container.textContent).toContain('JOSIELE DE JESUS SOBRINHO');
    expect(container.textContent).toContain('2 vida(s) no contrato novo');
  });

  it('inclui um dependente novo, que passa a contar como vida', () => {
    const { container, getByText } = montarNaEtapaDeDependentes();

    fireEvent.click(getByText('Incluir dependente'));
    incluirDependente(container, 'ANA BEATRIZ NETA', '2018-04-02');

    expect(container.textContent).toContain('ANA BEATRIZ NETA');
    expect(container.textContent).toContain('3 vida(s) no contrato novo');
  });

  it('o incluído agora pode sair da lista; o já cadastrado, não', () => {
    // A assimetria é a regra: o dependente que já existe no banco pode ter atendimento
    // apontando para a linha dele, e removê-lo daqui o apagaria do Postgres.
    const { container, getByText } = montarNaEtapaDeDependentes();
    expect(container.querySelectorAll('button[title="Remover dependente incluído agora"]')).toHaveLength(0);

    fireEvent.click(getByText('Incluir dependente'));
    incluirDependente(container, 'ANA BEATRIZ NETA', '2018-04-02');

    const remover = container.querySelectorAll('button[title="Remover dependente incluído agora"]');
    expect(remover).toHaveLength(1);

    fireEvent.click(remover[0]);
    expect(container.textContent).not.toContain('ANA BEATRIZ NETA');
    expect(container.textContent).toContain('2 vida(s) no contrato novo');
  });

  it('desmarcar um dependente tira a vida dele da contagem', () => {
    const { container } = montarNaEtapaDeDependentes();
    const caixa = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    fireEvent.click(caixa);
    expect(container.textContent).toContain('1 vida(s) no contrato novo');
  });
});

describe('ReativacaoAssociadoWizard — o que chega ao service', () => {
  it('manda o dependente incluído junto do cadastro, e marcado', async () => {
    // É o fim do caminho: sem isto, a inclusão seria só um número na tela — o contrato
    // nasceria com a vida a menos e as mensalidades cobrariam o valor errado.
    const { container, getByText } = montarNaEtapaDeDependentes();

    fireEvent.click(getByText('Incluir dependente'));
    incluirDependente(container, 'ANA BEATRIZ NETA', '2018-04-02');

    fireEvent.click(getByText('Avançar')); // etapa 3
    fireEvent.change(container.querySelector('select') as HTMLSelectElement, {
      target: { value: 'p1' },
    });
    fireEvent.click(getByText('Avançar')); // etapa 4
    fireEvent.click(getByText('Avançar')); // etapa 5
    fireEvent.click(getByText('Reativar e gerar contrato'));
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    const [dados] = vi.mocked(reativarAssociadoComNovoContrato).mock.calls[0];
    const nomes = (dados.associado.dependentes || []).map((d: any) => d.nome);
    expect(nomes).toContain('ANA BEATRIZ NETA');

    const novo = dados.associado.dependentes!.find((d: any) => d.nome === 'ANA BEATRIZ NETA')!;
    expect(dados.idsDependentesReativados).toContain(novo.id);
    expect(dados.valorPlano).toBe(300); // 3 vidas x 100 — a inclusão mudou o preço
  });
});
