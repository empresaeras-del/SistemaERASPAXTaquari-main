import { describe, it, expect } from 'vitest';
import {
  CODIGO_CATEGORIA_FALLBACK,
  categoriaIdParaGravacao,
  codigoDeCategoria,
  encontrarCategoriaComMesmoNome,
  indiceDeCategoriasPorNome,
  nomeDeCategoriaParaGravacao,
  nomesDeCategoriaParaFiltro,
  nomesDeCategoriaParaSelecao,
  ordenarCategorias,
} from './categoriasFornecedor';
import { CATEGORIAS_FORNECEDOR_PADRAO } from '../config/categoriasFornecedorPadrao.config';
import { CATEGORIA_EMPRESA_CONVENIADA } from './empresaVinculada';
import { CategoriaFornecedorRegistro } from '../types/categoriaFornecedor';

const cat = (
  over: Partial<CategoriaFornecedorRegistro> & { nome: string }
): CategoriaFornecedorRegistro => ({
  id: over.id ?? `id-${over.nome}`,
  tenant_id: 't1',
  codigo: over.codigo ?? codigoDeCategoria(over.nome),
  ativo: true,
  ...over,
});

describe('codigoDeCategoria', () => {
  it('tira acento, maiusculiza e troca símbolo por um hífen só', () => {
    expect(codigoDeCategoria('Urnas e Caixões')).toBe('URNAS-E-CAIXOES');
    expect(codigoDeCategoria('Comercial / Vendas')).toBe('COMERCIAL-VENDAS');
    expect(codigoDeCategoria('  Gráfica e Impressões  ')).toBe('GRAFICA-E-IMPRESSOES');
  });

  it('nome só de símbolos cai no fallback, nunca em código vazio numa coluna UNIQUE', () => {
    expect(codigoDeCategoria('///')).toBe(CODIGO_CATEGORIA_FALLBACK);
    expect(codigoDeCategoria('')).toBe(CODIGO_CATEGORIA_FALLBACK);
  });

  it('os 12 códigos da lista modelo são os que a migration de backfill gerou', () => {
    // Se as duas pontas divergirem, o app cria uma categoria duplicada em vez de reaproveitar
    // a que a migration criou — a lição de `codigoDeCentroCusto`. Estes 12 foram conferidos
    // contra o resultado real do backfill em produção.
    expect(CATEGORIAS_FORNECEDOR_PADRAO.map(codigoDeCategoria)).toEqual([
      'CONVENIOS-ASSOCIADOS',
      'URNAS-E-CAIXOES',
      'FLORICULTURA-E-COROAS',
      'MARMORARIA-E-LAPIDES',
      'TRANSLADO-E-VEICULOS',
      'EQUIPAMENTOS-MEDICOS',
      'TANATOPRAXIA-E-INSUMOS',
      'CEMITERIO-E-CREMATORIO',
      'GRAFICA-E-IMPRESSOES',
      'MANUTENCAO-E-CONSERVACAO',
      'TECNOLOGIA-E-SISTEMAS',
      'OUTROS',
    ]);
  });

  it('a categoria de empresa conveniada está na lista modelo', () => {
    // Todo o vínculo do associado PJ depende dela; fora da lista, uma empresa nova não
    // conseguiria cadastrar conveniada nenhuma.
    expect(CATEGORIAS_FORNECEDOR_PADRAO).toContain(CATEGORIA_EMPRESA_CONVENIADA);
  });
});

describe('nomeDeCategoriaParaGravacao', () => {
  it('apara as pontas e colapsa espaço do meio', () => {
    // Sem isso 'Outros ' e 'Outros' são nomes diferentes para a unique (tenant_id, nome).
    expect(nomeDeCategoriaParaGravacao('  Urnas   e  Caixões ')).toBe('Urnas e Caixões');
    expect(nomeDeCategoriaParaGravacao(null)).toBe('');
    expect(nomeDeCategoriaParaGravacao(undefined)).toBe('');
  });
});

describe('ordenarCategorias', () => {
  it('ativas primeiro, depois por nome', () => {
    const lista = [
      cat({ nome: 'Zebra' }),
      cat({ nome: 'Antiga', ativo: false }),
      cat({ nome: 'Alfa' }),
    ];
    expect(ordenarCategorias(lista).map((c) => c.nome)).toEqual(['Alfa', 'Zebra', 'Antiga']);
  });

  it('não muta o array de entrada', () => {
    const lista = [cat({ nome: 'B' }), cat({ nome: 'A' })];
    ordenarCategorias(lista);
    expect(lista.map((c) => c.nome)).toEqual(['B', 'A']);
  });
});

describe('encontrarCategoriaComMesmoNome', () => {
  const lista = [cat({ id: '1', nome: 'Urnas e Caixões' }), cat({ id: '2', nome: 'Outros' })];

  it('acusa duplicidade ignorando acento e caixa — é como o operador vê "igual"', () => {
    expect(encontrarCategoriaComMesmoNome(lista, 'urnas e caixoes')?.id).toBe('1');
    expect(encontrarCategoriaComMesmoNome(lista, '  OUTROS ')?.id).toBe('2');
  });

  it('o próprio registro em edição não conta como duplicata', () => {
    expect(encontrarCategoriaComMesmoNome(lista, 'Outros', '2')).toBeUndefined();
  });

  it('nome sem letra nem número não acusa nada — cairia todo mundo no fallback', () => {
    expect(encontrarCategoriaComMesmoNome(lista, '///')).toBeUndefined();
    expect(encontrarCategoriaComMesmoNome(lista, '')).toBeUndefined();
  });
});

describe('nomesDeCategoriaParaSelecao', () => {
  it('empresa sem nenhuma categoria cai na lista modelo, e não num select vazio', () => {
    expect(nomesDeCategoriaParaSelecao([])).toEqual([...CATEGORIAS_FORNECEDOR_PADRAO]);
  });

  it('com categorias cadastradas, oferece só as ativas, em ordem', () => {
    const lista = [
      cat({ nome: 'Zebra' }),
      cat({ nome: 'Antiga', ativo: false }),
      cat({ nome: 'Alfa' }),
    ];
    expect(nomesDeCategoriaParaSelecao(lista)).toEqual(['Alfa', 'Zebra']);
  });

  it('a categoria JÁ GRAVADA continua na lista mesmo desativada', () => {
    // Sem isso, abrir para editar perderia a seleção e o save reescreveria o campo em silêncio.
    const lista = [cat({ nome: 'Alfa' }), cat({ nome: 'Antiga', ativo: false })];
    expect(nomesDeCategoriaParaSelecao(lista, 'Antiga')).toEqual(['Alfa', 'Antiga']);
  });

  it('categoria gravada que nem existe na tabela também é preservada', () => {
    // Fornecedor legado cuja categoria não foi semeada: sumir com ela apagaria a classificação.
    expect(nomesDeCategoriaParaSelecao([], 'Categoria Antiga')).toContain('Categoria Antiga');
  });

  it('categoria excluída (deleted_at) não conta como cadastrada', () => {
    const lista = [cat({ nome: 'Alfa', deleted_at: '2026-01-01T00:00:00Z' })];
    expect(nomesDeCategoriaParaSelecao(lista)).toEqual([...CATEGORIAS_FORNECEDOR_PADRAO]);
  });
});

describe('nomesDeCategoriaParaFiltro', () => {
  it('categoria desativada com fornecedor dentro continua filtrável', () => {
    const lista = [cat({ nome: 'Alfa' }), cat({ nome: 'Antiga', ativo: false })];
    expect(nomesDeCategoriaParaFiltro(lista, ['Antiga'])).toEqual(['Alfa', 'Antiga']);
  });

  it('desativada sem ninguém usando sai do filtro', () => {
    const lista = [cat({ nome: 'Alfa' }), cat({ nome: 'Antiga', ativo: false })];
    expect(nomesDeCategoriaParaFiltro(lista, [])).toEqual(['Alfa']);
  });

  it('nome em uso que não está na tabela entra no fim, em vez de virar infiltrável', () => {
    const lista = [cat({ nome: 'Alfa' })];
    expect(nomesDeCategoriaParaFiltro(lista, ['Legado'])).toEqual(['Alfa', 'Legado']);
  });

  it('empresa sem categorias cai na lista modelo', () => {
    expect(nomesDeCategoriaParaFiltro([], [])).toEqual([...CATEGORIAS_FORNECEDOR_PADRAO]);
  });
});

describe('categoriaIdParaGravacao', () => {
  const lista = [cat({ id: 'c1', nome: 'Urnas e Caixões' }), cat({ id: 'c2', nome: 'Outros' })];

  it('resolve o id pelo nome escolhido no select', () => {
    expect(categoriaIdParaGravacao(lista, 'Outros')).toBe('c2');
  });

  it('devolve null — nunca undefined — quando o nome não está na tabela', () => {
    // `JSON.stringify` descarta chave `undefined`, e o update chegaria ao Postgres sem a
    // coluna: o id antigo ficaria no banco depois de o operador trocar a categoria na tela.
    expect(categoriaIdParaGravacao(lista, 'Inexistente')).toBeNull();
    expect(categoriaIdParaGravacao([], 'Outros')).toBeNull();
    expect(categoriaIdParaGravacao(lista, '')).toBeNull();
    expect(categoriaIdParaGravacao(lista, null)).toBeNull();
  });

  it('nome com espaço sobrando ainda resolve', () => {
    expect(categoriaIdParaGravacao(lista, '  Outros  ')).toBe('c2');
  });
});

describe('indiceDeCategoriasPorNome', () => {
  it('indexa pelo nome normalizado', () => {
    const indice = indiceDeCategoriasPorNome([cat({ id: 'c1', nome: ' Outros ' })]);
    expect(indice.get('Outros')?.id).toBe('c1');
  });
});
