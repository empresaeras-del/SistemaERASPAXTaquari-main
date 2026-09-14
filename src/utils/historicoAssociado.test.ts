import { describe, it, expect } from 'vitest';
import {
  LIMITE_POR_GRUPO,
  MENSAGEM_EXCLUSAO_BLOQUEADA,
  montarHistoricoImpeditivo,
} from './historicoAssociado';

const parcela = (n: number) => ({ titulo: `Parcela ${n}/12`, detalhe: 'Recebida em 10/08/2026' });
const atendimento = (nome: string) => ({ titulo: nome, detalhe: 'Óbito em 02/09/2026' });

describe('montarHistoricoImpeditivo', () => {
  it('sem histórico, não impede', () => {
    const h = montarHistoricoImpeditivo({ parcelasRecebidas: [], atendimentos: [] });
    expect(h.impede).toBe(false);
    expect(h.grupos).toEqual([]);
  });

  it('uma parcela recebida já impede', () => {
    // É o ponto da regra: a exclusão apaga a parcela recebida junto, e ela é dinheiro
    // que entrou no caixa.
    const h = montarHistoricoImpeditivo({ parcelasRecebidas: [parcela(1)], atendimentos: [] });
    expect(h.impede).toBe(true);
    expect(h.grupos[0].titulo).toBe('Parcelas recebidas');
    expect(h.grupos[0].total).toBe(1);
  });

  it('um atendimento já impede, mesmo sem parcela nenhuma', () => {
    const h = montarHistoricoImpeditivo({
      parcelasRecebidas: [],
      atendimentos: [atendimento('JOSÉ PEREIRA')],
    });
    expect(h.impede).toBe(true);
    expect(h.grupos).toHaveLength(1);
    expect(h.grupos[0].titulo).toBe('Atendimentos funerários');
  });

  it('os dois grupos convivem, na ordem financeiro → atendimento', () => {
    const h = montarHistoricoImpeditivo({
      parcelasRecebidas: [parcela(1)],
      atendimentos: [atendimento('JOSÉ PEREIRA')],
    });
    expect(h.grupos.map((g) => g.titulo)).toEqual(['Parcelas recebidas', 'Atendimentos funerários']);
  });

  it('lista no máximo LIMITE_POR_GRUPO, mas o total continua verdadeiro', () => {
    // Doze parcelas de um plano anual empurrariam o botão de inativar para fora da vista.
    const doze = Array.from({ length: 12 }, (_, i) => parcela(i + 1));
    const h = montarHistoricoImpeditivo({ parcelasRecebidas: doze, atendimentos: [] });
    expect(h.grupos[0].registros).toHaveLength(LIMITE_POR_GRUPO);
    expect(h.grupos[0].total).toBe(12);
  });

  it('o resumo concorda em número e plural', () => {
    expect(
      montarHistoricoImpeditivo({ parcelasRecebidas: [parcela(1)], atendimentos: [] }).resumo,
    ).toContain('1 parcela recebida');

    expect(
      montarHistoricoImpeditivo({ parcelasRecebidas: [parcela(1), parcela(2)], atendimentos: [] }).resumo,
    ).toContain('2 parcelas recebidas');

    const ambos = montarHistoricoImpeditivo({
      parcelasRecebidas: [parcela(1)],
      atendimentos: [atendimento('A'), atendimento('B')],
    }).resumo;
    expect(ambos).toContain('1 parcela recebida e 2 atendimentos');
  });

  it('tolera listas ausentes — o service pode falhar numa das consultas', () => {
    const h = montarHistoricoImpeditivo({ parcelasRecebidas: undefined as any, atendimentos: undefined as any });
    expect(h.impede).toBe(false);
  });

  it('a mensagem de recusa oferece a saída, não só a proibição', () => {
    expect(MENSAGEM_EXCLUSAO_BLOQUEADA).toContain('Inative');
  });
});
