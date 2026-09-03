import { describe, expect, it } from 'vitest';
import { calcularPosicaoArrastada } from './AssinaturaPosicionavel';

const rect = { left: 0, top: 0, width: 800, height: 1131 }; // proporção A4 aproximada

describe('calcularPosicaoArrastada', () => {
  it('converte a posição do ponteiro para % da largura/altura da página', () => {
    const result = calcularPosicaoArrastada(400, 226.2, rect);
    expect(result.x).toBeCloseTo(50, 0);
    expect(result.y).toBeCloseTo(20, 0);
  });

  it('imanta ao centro (50%) quando perto o suficiente, em vez do valor bruto', () => {
    const result = calcularPosicaoArrastada(404, 500, rect); // 50.5% em x, dentro do threshold de 1.5%
    expect(result.x).toBe(50);
    expect(result.snapX).toBe(true);
  });

  it('não imanta quando está claramente longe do centro', () => {
    const result = calcularPosicaoArrastada(100, 500, rect); // 12.5% em x
    expect(result.x).toBeCloseTo(12.5, 1);
    expect(result.snapX).toBe(false);
  });

  it('nunca deixa a posição colar nas bordas (mínimo 2%, máximo 98%)', () => {
    const canto = calcularPosicaoArrastada(-500, -500, rect);
    expect(canto.x).toBe(2);
    expect(canto.y).toBe(2);

    const foraDaFolha = calcularPosicaoArrastada(5000, 5000, rect);
    expect(foraDaFolha.x).toBe(98);
    expect(foraDaFolha.y).toBe(98);
  });

  it('imanta em x e y de forma independente', () => {
    const soCentroVertical = calcularPosicaoArrastada(100, 565.5, rect); // x longe, y no centro
    expect(soCentroVertical.snapX).toBe(false);
    expect(soCentroVertical.snapY).toBe(true);
    expect(soCentroVertical.y).toBe(50);
  });
});
