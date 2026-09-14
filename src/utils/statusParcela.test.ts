import { describe, it, expect } from 'vitest';
import { MENSAGEM_PARCELA_LIQUIDADA, parcelaLiquidada } from './statusParcela';

describe('parcelaLiquidada', () => {
  it('reconhece os dois nomes do mesmo estado', () => {
    // A tela de Contas a Receber olhava só 'recebido': uma parcela 'pago' continuava
    // editável e excluível lá.
    expect(parcelaLiquidada('recebido')).toBe(true);
    expect(parcelaLiquidada('pago')).toBe(true);
  });

  it('não trava parcela em aberto', () => {
    expect(parcelaLiquidada('pendente')).toBe(false);
    expect(parcelaLiquidada('vencido')).toBe(false);
    expect(parcelaLiquidada('atrasado')).toBe(false);
    expect(parcelaLiquidada('negociado')).toBe(false);
  });

  it('parcela cancelada não conta como liquidada — ela não recebeu nada', () => {
    expect(parcelaLiquidada('cancelado')).toBe(false);
  });

  it('tolera caixa e espaço, porque o status vem de fontes diferentes', () => {
    expect(parcelaLiquidada(' RECEBIDO ')).toBe(true);
    expect(parcelaLiquidada('Pago')).toBe(true);
  });

  it('status ausente não trava — parcela sem status é tratada como pendente na tela', () => {
    expect(parcelaLiquidada(undefined)).toBe(false);
    expect(parcelaLiquidada(null)).toBe(false);
    expect(parcelaLiquidada('')).toBe(false);
  });

  it('a mensagem aponta o caminho de correção, não só a recusa', () => {
    expect(MENSAGEM_PARCELA_LIQUIDADA).toContain('Estorne');
  });
});
