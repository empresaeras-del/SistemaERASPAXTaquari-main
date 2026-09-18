import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RelatorioCarteiraConveniadaModal } from './RelatorioCarteiraConveniadaModal';
import { montarCarteiraEmpresaConveniada } from '../../utils/carteiraEmpresaConveniada';
import { Associado } from '../../services/associadosService';
import { ParcelaReceber, Receita } from '../../services/financeiroService';

const EMPRESA = 'forn-1';

const assoc = (id: string, nome: string, cpf?: string): Associado =>
  ({ id, nome, cpf, status: 'ativo', tipo_pessoa: 'PJ', fornecedor_id: EMPRESA }) as Associado;

const parc = (o: Partial<ParcelaReceber> & { id: string }): ParcelaReceber =>
  ({
    tenant_id: 't1',
    receita_id: 'r-a1',
    numero_parcela: 1,
    valor: 60,
    data_vencimento: '2026-03-10',
    status: 'pendente',
    ...o,
  }) as ParcelaReceber;

const carteira = montarCarteiraEmpresaConveniada({
  associados: [assoc('a1', 'EDSON RENIS', '017.989.211-89')],
  parcelas: [
    // Setembro RECEBIDO, outubro EM ABERTO — é o par que denuncia cor tirada da posição.
    parc({ id: 'p1', data_vencimento: '2026-09-10', status: 'recebido', valor_recebido: 70 }),
    parc({ id: 'p2', data_vencimento: '2026-10-10', valor: 60 }),
    parc({ id: 'p3', data_vencimento: '2027-01-10', valor: 55 }),
  ],
  receitas: [{ id: 'r-a1', associado_id: 'a1' } as Receita],
  fornecedorId: EMPRESA,
  exercicio: 2026,
});

const montarModal = () =>
  render(
    // Aninhamento real: overlay com `backdrop-blur` do formulário de fornecedor + `<form>`.
    <div className="fixed inset-0 z-50 bg-bg-base/80 backdrop-blur-sm p-4">
      <form id="fornecedor-form">
        <RelatorioCarteiraConveniadaModal
          isOpen
          onClose={() => {}}
          carteira={carteira}
          nomeConveniada="CAIXA DE ASSISTENCIA"
          documentoConveniada="03.406.318/0001-30"
          empresaData={null}
          userName="OPERADOR"
        />
      </form>
    </div>,
  );

describe('RelatorioCarteiraConveniadaModal', () => {
  it('vai para o document.body por portal — fora do <form> e do overlay borrado', () => {
    montarModal();
    const overlay = screen.getByText('Carteira de Convênio').closest('.fixed');
    expect(overlay).not.toBeNull();
    expect(overlay!.parentElement).toBe(document.body);
    expect(overlay!.closest('form')).toBeNull();
  });

  it('todo botão declara `type`', () => {
    montarModal();
    expect([...document.querySelectorAll('button')].filter((b) => !b.getAttribute('type'))).toHaveLength(0);
  });

  it('o valor EM ABERTO não sai na cor do recebido', () => {
    // Set (recebido) e Out (em aberto) têm de ter cores diferentes. Colorindo pela posição da
    // linha na célula, os dois sairiam verdes — foi o que a foto pegou.
    montarModal();
    // O jsdom normaliza o hex do `style` para `rgb()`, então o esperado vem na mesma forma.
    const recebido = screen.getAllByText('70,00')[0];
    const aberto = screen.getAllByText('60,00')[0];
    expect(recebido.style.color).toBe('rgb(4, 120, 87)'); // #047857
    expect(aberto.style.color).toBe('rgb(180, 83, 9)'); // #b45309
    expect(recebido.style.color).not.toBe(aberto.style.color);
  });

  it('os 12 meses declaram a mesma largura, tenham valor ou não', () => {
    montarModal();
    const cols = [...document.querySelectorAll('col')];
    const larguraDosMeses = new Set(cols.slice(2, 14).map((c) => (c as HTMLElement).style.width));
    expect(cols).toHaveLength(15);
    expect(larguraDosMeses.size).toBe(1);
  });

  it('trocar para Resumo muda as colunas e vira retrato sozinho', () => {
    // A grade de 12 meses não fecha em retrato; o resumo sim. Deixar a orientação como estava
    // faria o operador descobrir isso pela prévia cortada.
    montarModal();
    expect(screen.queryByText('Jan')).toBeTruthy();
    fireEvent.click(screen.getByText('Resumo'));
    expect(screen.queryByText('Jan')).toBeNull();
    expect(screen.getByText('Vencimento mais antigo')).toBeTruthy();
    expect(document.querySelectorAll('col')).toHaveLength(7);
  });

  it('o que está fora dos totais vai impresso, em vez de sumir', () => {
    montarModal();
    expect(screen.getByText('Fora dos totais acima')).toBeTruthy();
    expect(screen.getByText(/outros exercícios/)).toBeTruthy();
  });

  it('o cabeçalho nomeia a conveniada e o exercício', () => {
    montarModal();
    expect(screen.getAllByText('CAIXA DE ASSISTENCIA').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Exercício 2026/).length).toBeGreaterThan(0);
  });

  it('o documento do associado sai mascarado pela regra dos relatórios financeiros', () => {
    montarModal();
    expect(screen.getByText('***.989.211-**')).toBeTruthy();
  });

  it('imprimir avisa quando o navegador bloqueia a janela, em vez de falhar calado', () => {
    montarModal();
    const abrir = vi.spyOn(window, 'open').mockReturnValue(null);
    fireEvent.click(screen.getByText('Imprimir'));
    expect(abrir).toHaveBeenCalled();
    abrir.mockRestore();
  });
});
