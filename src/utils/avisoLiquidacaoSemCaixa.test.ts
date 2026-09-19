import { describe, it, expect } from 'vitest';
import { avisoLiquidacaoSemCaixa } from './avisoLiquidacaoSemCaixa';

describe('avisoLiquidacaoSemCaixa', () => {
  it('diz que a baixa VALEU — é o que impede o operador de repeti-la', () => {
    const aviso = avisoLiquidacaoSemCaixa('recebimento');
    expect(aviso).toMatch(/Recebimento registrado na parcela/);
    expect(aviso).toMatch(/não repita a baixa/i);
  });

  it('diz a consequência prática, não só que falhou', () => {
    // "Erro ao efetivar recebimento" não deixa ninguém decidir nada. Isto deixa.
    const aviso = avisoLiquidacaoSemCaixa('recebimento');
    expect(aviso).toMatch(/saldo do lote/);
    expect(aviso).toMatch(/conferência do fechamento/);
  });

  it('aponta a saída, que é a integração da tela de Caixas', () => {
    expect(avisoLiquidacaoSemCaixa('pagamento')).toMatch(/Sincronizar Financeiro/);
  });

  it('distingue recebimento de pagamento', () => {
    expect(avisoLiquidacaoSemCaixa('pagamento')).toMatch(/^Pagamento registrado/);
    expect(avisoLiquidacaoSemCaixa('recebimento')).toMatch(/^Recebimento registrado/);
  });

  it('carrega o motivo do servidor quando existe', () => {
    const aviso = avisoLiquidacaoSemCaixa('recebimento', 'violates check constraint');
    expect(aviso).toMatch(/Motivo: violates check constraint/);
  });

  it('sem motivo, não imprime um "Motivo:" vazio', () => {
    expect(avisoLiquidacaoSemCaixa('recebimento')).not.toMatch(/Motivo:/);
    expect(avisoLiquidacaoSemCaixa('recebimento', '   ')).not.toMatch(/Motivo:/);
  });
});
