import { describe, it, expect } from 'vitest';
import type { Associado } from '../services/associadosService';
import {
  DESCRICAO_FAIXA,
  ROTULO_SEM_LOCALIZACAO,
  faixaPorIntensidade,
  indiceDeAssociados,
  montarMapaDeCalor,
  normalizarLocalidade,
  resolverAssociadoDaParcela,
  roteiroSugerido,
  type ParcelaParaMapa,
} from './mapaCalorReceber';

const assoc = (over: Partial<Associado> = {}): Associado =>
  ({
    id: 'a1',
    nome: 'EDSON RENIS ALVES DA SILVA',
    cpf: '017.989.211-89',
    endereco_cidade: 'COXIM - MS',
    endereco_bairro: 'SENHOR DIVINO',
    ...over,
  }) as Associado;

const parcela = (over: Partial<ParcelaParaMapa> = {}): ParcelaParaMapa => ({
  id: 'p1',
  status: 'pendente',
  valor: 60,
  data_vencimento: '2026-10-10',
  devedor_nome: 'EDSON RENIS ALVES DA SILVA',
  devedor_cpf_cnpj: '01798921189',
  ...over,
});

const HOJE = '2026-09-15';

describe('normalizarLocalidade', () => {
  it('junta as grafias do mesmo lugar', () => {
    expect(normalizarLocalidade('coxim  - ms ')).toBe(normalizarLocalidade('COXIM - MS'));
  });

  it('tira acento, porque "SÃO" e "SAO" convivem no mesmo cadastro', () => {
    expect(normalizarLocalidade('São Gabriel')).toBe('SAO GABRIEL');
  });

  it('vazio não quebra', () => {
    expect(normalizarLocalidade(undefined)).toBe('');
  });
});

describe('resolverAssociadoDaParcela', () => {
  const alvo = assoc({ id: 'certo', cpf: '11111111111', nome: 'QUEM PAGA' });
  const outro = assoc({ id: 'outro', cpf: '22222222222', nome: 'HOMONIMO' });
  const indice = indiceDeAssociados([alvo, outro]);

  it('a chave de verdade vence o CPF e o nome', () => {
    const achado = resolverAssociadoDaParcela(
      { receita_id: 'r1', devedor_cpf_cnpj: '22222222222', devedor_nome: 'HOMONIMO' },
      indice,
      new Map([['r1', { id: 'r1', associado_id: 'certo' }]]),
    );
    expect(achado?.id).toBe('certo');
  });

  it('sem receita, casa pelo CPF mesmo formatado', () => {
    expect(resolverAssociadoDaParcela({ devedor_cpf_cnpj: '111.111.111-11' }, indice)?.id).toBe('certo');
  });

  it('o nome é o último recurso', () => {
    expect(resolverAssociadoDaParcela({ devedor_nome: '  quem paga ' }, indice)?.id).toBe('certo');
  });

  it('sem nada que case, devolve undefined em vez de chutar', () => {
    expect(resolverAssociadoDaParcela({ devedor_nome: 'NINGUEM' }, indice)).toBeUndefined();
  });
});

describe('montarMapaDeCalor', () => {
  const associados = [
    assoc({ id: 'a1', cpf: '111', nome: 'A UM', endereco_bairro: 'SENHOR DIVINO' }),
    assoc({ id: 'a2', cpf: '222', nome: 'A DOIS', endereco_bairro: 'NOVA COXIM' }),
    assoc({ id: 'a3', cpf: '333', nome: 'A TRES', endereco_bairro: 'senhor divino' }),
  ];

  it('agrupa por município e, dentro dele, por bairro', () => {
    const mapa = montarMapaDeCalor(
      [
        parcela({ id: '1', devedor_cpf_cnpj: '111', valor: 100 }),
        parcela({ id: '2', devedor_cpf_cnpj: '333', valor: 50 }),
        parcela({ id: '3', devedor_cpf_cnpj: '222', valor: 30 }),
      ],
      { associados, hoje: HOJE },
    );

    expect(mapa.municipios).toHaveLength(1);
    expect(mapa.municipios[0].rotulo).toBe('COXIM - MS');
    expect(mapa.totalAReceber).toBe(180);
    // "SENHOR DIVINO" e "senhor divino" são a mesma zona, e vêm primeiro por ter mais.
    expect(mapa.municipios[0].bairros.map((b) => [b.rotulo, b.valorAReceber])).toEqual([
      ['SENHOR DIVINO', 150],
      ['NOVA COXIM', 30],
    ]);
  });

  it('conta devedores distintos, não boletos — é quantas visitas a zona representa', () => {
    const mapa = montarMapaDeCalor(
      [
        parcela({ id: '1', devedor_cpf_cnpj: '111', valor: 60 }),
        parcela({ id: '2', devedor_cpf_cnpj: '111', valor: 60 }),
        parcela({ id: '3', devedor_cpf_cnpj: '333', valor: 60 }),
      ],
      { associados, hoje: HOJE },
    );
    const bairro = mapa.municipios[0].bairros[0];
    expect(bairro.qtdAReceber).toBe(3);
    expect(bairro.devedores).toBe(2);
  });

  it('recebida e cancelada NÃO entram na soma — viram nota', () => {
    // Mandar o cobrador a um bairro cujo calor é dinheiro que já entrou é o erro que
    // este relatório existe para evitar.
    const mapa = montarMapaDeCalor(
      [
        parcela({ id: '1', devedor_cpf_cnpj: '111', valor: 100 }),
        parcela({ id: '2', devedor_cpf_cnpj: '111', valor: 500, status: 'recebido' }),
        parcela({ id: '3', devedor_cpf_cnpj: '111', valor: 70, status: 'pago' }),
        parcela({ id: '4', devedor_cpf_cnpj: '111', valor: 30, status: 'cancelado' }),
      ],
      { associados, hoje: HOJE },
    );

    expect(mapa.totalAReceber).toBe(100);
    expect(mapa.foraDaCobranca).toEqual({ valor: 600, quantidade: 3 });
  });

  it('"em aberto" tem três nomes, e os três entram', () => {
    const mapa = montarMapaDeCalor(
      [
        parcela({ id: '1', devedor_cpf_cnpj: '111', valor: 10, status: 'pendente' }),
        parcela({ id: '2', devedor_cpf_cnpj: '111', valor: 20, status: 'vencido' }),
        parcela({ id: '3', devedor_cpf_cnpj: '111', valor: 30, status: 'atrasado' }),
      ],
      { associados, hoje: HOJE },
    );
    expect(mapa.qtdAReceber).toBe(3);
    expect(mapa.totalAReceber).toBe(60);
  });

  it('vencida é decidida pelo texto da data, contra o hoje injetado', () => {
    const mapa = montarMapaDeCalor(
      [
        parcela({ id: '1', devedor_cpf_cnpj: '111', valor: 40, data_vencimento: '2026-09-14' }),
        parcela({ id: '2', devedor_cpf_cnpj: '111', valor: 60, data_vencimento: '2026-09-15' }),
        parcela({ id: '3', devedor_cpf_cnpj: '111', valor: 80, data_vencimento: '2026-12-01' }),
      ],
      { associados, hoje: HOJE },
    );
    // Vence hoje ainda não está vencida.
    expect(mapa.totalVencido).toBe(40);
    expect(mapa.qtdVencida).toBe(1);
  });

  it('parcela sem dono ou sem endereço vira nota, não some nem polui uma zona', () => {
    const mapa = montarMapaDeCalor(
      [
        parcela({ id: '1', devedor_cpf_cnpj: '111', valor: 100 }),
        parcela({ id: '2', devedor_cpf_cnpj: '999', devedor_nome: 'CLIENTE AVULSO', valor: 45 }),
      ],
      { associados, hoje: HOJE },
    );

    expect(mapa.semLocalizacao).toEqual({ valor: 45, quantidade: 1 });
    // Continua no total: é dinheiro a receber, só não roteirizável.
    expect(mapa.totalAReceber).toBe(145);
    expect(mapa.municipios).toHaveLength(1);
  });

  it('associado com só o campo legado preenchido ainda é localizado', () => {
    const legado = {
      id: 'a9', nome: 'ANTIGO', cpf: '999',
      cidade: 'RIO VERDE - MS', bairro: 'CENTRO',
    } as unknown as Associado;
    const mapa = montarMapaDeCalor([parcela({ devedor_cpf_cnpj: '999', valor: 70 })], {
      associados: [legado],
      hoje: HOJE,
    });
    expect(mapa.municipios[0].rotulo).toBe('RIO VERDE - MS');
    expect(mapa.municipios[0].bairros[0].rotulo).toBe('CENTRO');
  });

  it('o bairro sem nome aparece rotulado, em vez de virar uma zona em branco', () => {
    const semBairro = assoc({ id: 'a8', cpf: '888', endereco_bairro: '' });
    const mapa = montarMapaDeCalor([parcela({ devedor_cpf_cnpj: '888', valor: 25 })], {
      associados: [semBairro],
      hoje: HOJE,
    });
    expect(mapa.municipios[0].bairros[0].rotulo).toBe(ROTULO_SEM_LOCALIZACAO);
  });

  it('a zona líder é sempre a mais quente, mesmo com muitos bairros', () => {
    // Cortar por participação no total deixava o topo da rampa sem uso: com cinco
    // bairros o maior tinha 31,6% e nada chegava a "Crítica" — justamente a linha que o
    // cobrador procura.
    const muitos = Array.from({ length: 5 }, (_, i) =>
      assoc({ id: `m${i}`, cpf: `90${i}`, endereco_bairro: `BAIRRO ${i}` }),
    );
    const mapa = montarMapaDeCalor(
      muitos.map((a, i) => parcela({ id: `p${i}`, devedor_cpf_cnpj: a.cpf, valor: 100 - i * 10 })),
      { associados: muitos, hoje: HOJE },
    );
    const bairros = mapa.municipios[0].bairros;
    expect(bairros[0].faixa).toBe('critica');
    expect(bairros[0].intensidade).toBe(1);
    // E a participação absoluta continua sendo reportada, sem virar a cor.
    expect(bairros[0].participacao).toBeCloseTo(100 / 400, 5);
  });

  it('município e bairro são medidos cada um contra o líder do próprio nível', () => {
    const associadosDoisMun = [
      assoc({ id: 'x1', cpf: '701', endereco_cidade: 'CIDADE GRANDE', endereco_bairro: 'CENTRO' }),
      assoc({ id: 'x2', cpf: '702', endereco_cidade: 'CIDADE PEQUENA', endereco_bairro: 'UNICO' }),
    ];
    const mapa = montarMapaDeCalor(
      [
        parcela({ id: '1', devedor_cpf_cnpj: '701', valor: 900 }),
        parcela({ id: '2', devedor_cpf_cnpj: '702', valor: 100 }),
      ],
      { associados: associadosDoisMun, hoje: HOJE },
    );
    expect(mapa.municipios[0].faixa).toBe('critica');
    expect(mapa.municipios[1].faixa).toBe('baixa');
    expect(mapa.municipios[0].bairros[0].intensidade).toBe(1);
  });

  it('sem parcela nenhuma, devolve um mapa vazio sem dividir por zero', () => {
    const mapa = montarMapaDeCalor([], { associados, hoje: HOJE });
    expect(mapa.municipios).toEqual([]);
    expect(mapa.totalAReceber).toBe(0);
  });
});

describe('faixaPorIntensidade', () => {
  it('os cortes são relativos à zona mais quente', () => {
    expect(faixaPorIntensidade(1)).toBe('critica');
    expect(faixaPorIntensidade(0.75)).toBe('critica');
    expect(faixaPorIntensidade(0.5)).toBe('alta');
    expect(faixaPorIntensidade(0.25)).toBe('media');
    expect(faixaPorIntensidade(0.05)).toBe('baixa');
  });

  it('toda faixa tem rótulo e cor — a cor nunca vai sozinha ao papel', () => {
    for (const faixa of ['critica', 'alta', 'media', 'baixa'] as const) {
      expect(DESCRICAO_FAIXA[faixa].rotulo.length).toBeGreaterThan(0);
      expect(DESCRICAO_FAIXA[faixa].cor).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe('roteiroSugerido', () => {
  const associados = [
    assoc({ id: 'a1', cpf: '111', endereco_bairro: 'CENTRO' }),
    assoc({ id: 'a2', cpf: '222', endereco_bairro: 'VILA BELA III' }),
  ];

  it('achata os bairros em ordem de valor, numerando a rota', () => {
    const mapa = montarMapaDeCalor(
      [
        parcela({ id: '1', devedor_cpf_cnpj: '111', valor: 30 }),
        parcela({ id: '2', devedor_cpf_cnpj: '222', valor: 90 }),
      ],
      { associados, hoje: HOJE },
    );
    const rota = roteiroSugerido(mapa);
    expect(rota.map((l) => [l.ordem, l.bairro])).toEqual([
      [1, 'VILA BELA III'],
      [2, 'CENTRO'],
    ]);
  });

  it('empatado o valor, o vencido decide — é a visita que não pode esperar', () => {
    const mapa = montarMapaDeCalor(
      [
        parcela({ id: '1', devedor_cpf_cnpj: '111', valor: 50, data_vencimento: '2026-12-01' }),
        parcela({ id: '2', devedor_cpf_cnpj: '222', valor: 50, data_vencimento: '2026-08-01' }),
      ],
      { associados, hoje: HOJE },
    );
    expect(roteiroSugerido(mapa)[0].bairro).toBe('VILA BELA III');
  });

  it('respeita o limite de linhas', () => {
    const mapa = montarMapaDeCalor(
      [parcela({ devedor_cpf_cnpj: '111', valor: 10 }), parcela({ id: '2', devedor_cpf_cnpj: '222', valor: 20 })],
      { associados, hoje: HOJE },
    );
    expect(roteiroSugerido(mapa, 1)).toHaveLength(1);
  });
});
