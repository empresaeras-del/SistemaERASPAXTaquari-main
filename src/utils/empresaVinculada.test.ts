import { describe, it, expect } from 'vitest';
import {
  CATEGORIA_EMPRESA_CONVENIADA,
  FILTRO_SOMENTE_PJ,
  associadoCasaFiltroEmpresa,
  ehPessoaJuridica,
  indiceDeEmpresas,
  nomeDaEmpresa,
  nomeDaEmpresaDoAssociado,
  opcoesEmpresaConveniada,
  opcoesFiltroEmpresa,
  vinculoEmpresaParaGravacao,
} from './empresaVinculada';
import { Associado } from '../services/associadosService';
import { Fornecedor } from '../types/fornecedores';

const UUID_CASSEMS = '67ca71da-630f-4d84-8140-a327839d5719';
const UUID_OUTRA = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

const forn = (over: Partial<Fornecedor> & { id: string }): Fornecedor =>
  ({
    codigo: 'F-1',
    razao_social: 'EMPRESA',
    nome_fantasia: '',
    cnpj_cpf: '',
    tipo_pessoa: 'PJ',
    tipo_fornecedor: 'servicos',
    categoria: CATEGORIA_EMPRESA_CONVENIADA,
    status: 'ativo',
    created_at: '',
    updated_at: '',
    ...over,
  }) as Fornecedor;

const assoc = (over: Partial<Associado>): Associado =>
  ({ id: 'a1', nome: 'FULANO', status: 'ativo', ...over }) as Associado;

describe('ehPessoaJuridica', () => {
  it('só é PJ quando o tipo diz isso; ausente é PF (o default do schema)', () => {
    expect(ehPessoaJuridica('PJ')).toBe(true);
    expect(ehPessoaJuridica('PF')).toBe(false);
    expect(ehPessoaJuridica(undefined)).toBe(false);
    expect(ehPessoaJuridica(null)).toBe(false);
    expect(ehPessoaJuridica('')).toBe(false);
  });
});

describe('vinculoEmpresaParaGravacao', () => {
  it('grava o id quando o cadastro é PJ', () => {
    expect(vinculoEmpresaParaGravacao('PJ', UUID_CASSEMS)).toBe(UUID_CASSEMS);
  });

  it('string vazia vira null, nunca chega ao uuid do Postgres', () => {
    // Um '' numa coluna uuid é 22P02 — foi o que manteve `atendimentos` com zero linhas.
    expect(vinculoEmpresaParaGravacao('PJ', '')).toBeNull();
    expect(vinculoEmpresaParaGravacao('PJ', '   ')).toBeNull();
  });

  it('valor que não é uuid vira null em vez de viajar como lixo', () => {
    expect(vinculoEmpresaParaGravacao('PJ', 'id-invalido')).toBeNull();
  });

  it('cadastro que deixou de ser PJ perde o vínculo, mesmo com id na tela', () => {
    // Sem isso sobraria um vínculo órfão: invisível no formulário e visível no filtro.
    expect(vinculoEmpresaParaGravacao('PF', UUID_CASSEMS)).toBeNull();
    expect(vinculoEmpresaParaGravacao(undefined, UUID_CASSEMS)).toBeNull();
  });

  it('devolve null e nunca undefined — é null que de fato limpa a coluna no upsert', () => {
    // `JSON.stringify` descarta chave undefined: o payload chegaria sem a coluna e o valor
    // antigo continuaria no banco, sem erro nenhum.
    const out = vinculoEmpresaParaGravacao('PF', UUID_CASSEMS);
    expect(out).toBeNull();
    expect(out).not.toBeUndefined();
  });
});

describe('nomeDaEmpresa', () => {
  it('prefere razão social e cai para o nome fantasia', () => {
    expect(nomeDaEmpresa(forn({ id: '1', razao_social: 'CASSEMS', nome_fantasia: 'Cassems' }))).toBe('CASSEMS');
    expect(nomeDaEmpresa(forn({ id: '1', razao_social: '', nome_fantasia: 'Cassems' }))).toBe('Cassems');
    expect(nomeDaEmpresa(null)).toBe('');
  });
});

describe('nomeDaEmpresaDoAssociado', () => {
  const indice = indiceDeEmpresas([forn({ id: UUID_CASSEMS, razao_social: 'CASSEMS' })]);

  it('resolve pelo id da empresa', () => {
    expect(nomeDaEmpresaDoAssociado(assoc({ tipo_pessoa: 'PJ', fornecedor_id: UUID_CASSEMS }), indice)).toBe('CASSEMS');
  });

  it('devolve vazio para PF, mesmo que sobre um id no registro', () => {
    expect(nomeDaEmpresaDoAssociado(assoc({ tipo_pessoa: 'PF', fornecedor_id: UUID_CASSEMS }), indice)).toBe('');
  });

  it('devolve vazio quando a empresa não está na lista carregada', () => {
    expect(nomeDaEmpresaDoAssociado(assoc({ tipo_pessoa: 'PJ', fornecedor_id: UUID_OUTRA }), indice)).toBe('');
  });

  it('não quebra com associado nulo', () => {
    expect(nomeDaEmpresaDoAssociado(null, indice)).toBe('');
  });
});

describe('opcoesEmpresaConveniada', () => {
  const ativa = forn({ id: UUID_CASSEMS, razao_social: 'CASSEMS' });
  const desativada = forn({ id: UUID_OUTRA, razao_social: 'ANTIGA', status: 'inativo' });
  const outraCategoria = forn({ id: 'f3', razao_social: 'PAPELARIA', categoria: 'Materiais' });

  it('oferece só as conveniadas ativas', () => {
    const out = opcoesEmpresaConveniada([ativa, desativada, outraCategoria]);
    expect(out.map((f) => f.id)).toEqual([UUID_CASSEMS]);
  });

  it('mantém visível a empresa JÁ GRAVADA mesmo depois de desativada', () => {
    // Sem isso, abrir o cadastro para editar perderia a seleção e salvaria o vínculo vazio.
    const out = opcoesEmpresaConveniada([ativa, desativada], UUID_OUTRA);
    expect(out.map((f) => f.id).sort()).toEqual([UUID_OUTRA, UUID_CASSEMS].sort());
  });

  it('não duplica a já gravada quando ela continua ativa', () => {
    const out = opcoesEmpresaConveniada([ativa], UUID_CASSEMS);
    expect(out).toHaveLength(1);
  });
});

describe('opcoesFiltroEmpresa', () => {
  const ativa = forn({ id: UUID_CASSEMS, razao_social: 'CASSEMS' });
  const desativada = forn({ id: UUID_OUTRA, razao_social: 'ANTIGA', status: 'inativo' });

  it('inclui a desativada que ainda tem associado vinculado', () => {
    // Sem ela na lista, esses associados virariam infiltráveis.
    const out = opcoesFiltroEmpresa(
      [ativa, desativada],
      [assoc({ tipo_pessoa: 'PJ', fornecedor_id: UUID_OUTRA })]
    );
    expect(out.map((f) => f.id).sort()).toEqual([UUID_OUTRA, UUID_CASSEMS].sort());
  });

  it('deixa de fora a desativada sem nenhum vínculo', () => {
    const out = opcoesFiltroEmpresa([ativa, desativada], []);
    expect(out.map((f) => f.id)).toEqual([UUID_CASSEMS]);
  });
});

describe('associadoCasaFiltroEmpresa', () => {
  const pjComEmpresa = assoc({ tipo_pessoa: 'PJ', fornecedor_id: UUID_CASSEMS });
  const pjSemEmpresa = assoc({ tipo_pessoa: 'PJ' });
  const pessoaFisica = assoc({ tipo_pessoa: 'PF' });

  it('sem filtro, tudo casa', () => {
    expect(associadoCasaFiltroEmpresa(pessoaFisica, '')).toBe(true);
    expect(associadoCasaFiltroEmpresa(pjComEmpresa, undefined)).toBe(true);
  });

  it('filtrando por uma empresa, só o PJ dela casa', () => {
    expect(associadoCasaFiltroEmpresa(pjComEmpresa, UUID_CASSEMS)).toBe(true);
    expect(associadoCasaFiltroEmpresa(pjComEmpresa, UUID_OUTRA)).toBe(false);
    expect(associadoCasaFiltroEmpresa(pessoaFisica, UUID_CASSEMS)).toBe(false);
  });

  it('"somente PJ" inclui o PJ que ainda não tem empresa escolhida', () => {
    // Ele existe e precisa ser encontrável — é justamente o cadastro que falta completar.
    expect(associadoCasaFiltroEmpresa(pjSemEmpresa, FILTRO_SOMENTE_PJ)).toBe(true);
    expect(associadoCasaFiltroEmpresa(pessoaFisica, FILTRO_SOMENTE_PJ)).toBe(false);
  });

  it('um PF com id residual não casa por empresa — quem decide é o tipo', () => {
    expect(associadoCasaFiltroEmpresa(assoc({ tipo_pessoa: 'PF', fornecedor_id: UUID_CASSEMS }), UUID_CASSEMS)).toBe(false);
  });
});
