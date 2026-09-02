import { PlanoPaxCompleto, SimulacaoValor } from '../types/planosPax';

/**
 * Calcula o valor de mensalidade de um plano PAX.
 *
 * Extraído de `usePlanosPax` para permitir testes unitários sem depender
 * de contexto de autenticação, Supabase ou IndexedDB.
 */
export const calcularValorPlano = (
  plano: PlanoPaxCompleto | undefined,
  totalVidas?: number,
  idadesDependentes?: number[],
  valorExtra?: number
): SimulacaoValor => {
  if (!plano) return { base: 0, por_vida: 0, total: 0, descricao: '' };

  let base = 0;
  let descricao = '';
  const vidas = totalVidas || 1;

  if (plano.tipo_plano === 'individual') {
    const minVidas = plano.minimo_vidas_calculo || 1;
    const calculoVidas = vidas <= minVidas ? minVidas : vidas;
    base = plano.valor_mensalidade * calculoVidas;
    descricao = `Valor por vida (${calculoVidas}x R$ ${plano.valor_mensalidade})`;
    if (vidas <= minVidas) {
      descricao += ` (Mínimo de ${minVidas} vidas)`;
    }
  } else {
    // Coletivo
    base = plano.valor_mensalidade + (Number(valorExtra) || 0);
    descricao = 'Valor Base Coletivo' + (Number(valorExtra) > 0 ? ` + Valor Extra (R$ ${valorExtra})` : '');
  }

  let adicionaisDependentes = 0;
  if (idadesDependentes && idadesDependentes.length > 0 && plano.faixas && plano.faixas.length > 0) {
    idadesDependentes.forEach(idade => {
      const faixa = plano.faixas.find(f => idade >= f.idade_de && idade <= f.idade_ate);
      if (faixa) {
        adicionaisDependentes += faixa.valor;
      }
    });
    if (adicionaisDependentes > 0) {
      descricao += ` + Adicional Dependentes (R$ ${adicionaisDependentes})`;
    }
  }

  return {
    base: base,
    por_vida: plano.tipo_plano === 'individual' ? plano.valor_mensalidade : 0,
    total: base + adicionaisDependentes,
    descricao: descricao
  };
};
