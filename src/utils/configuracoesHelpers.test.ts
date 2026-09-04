import { describe, it, expect } from 'vitest';
import {
  filtrarUsuarios,
  formatAgenciaOuConta,
  normalizeModulos,
  normalizarModulosParaSalvar,
} from './configuracoesHelpers';
import { UsuarioCadastro } from '../services/usuariosService';
import { getAllModuleAndSubmoduleIds } from './permissions';

const mkUsuario = (over: Partial<UsuarioCadastro>): UsuarioCadastro => ({
  id: over.id || 'u1',
  tenant_id: 'default_tenant',
  nome: 'Sem Nome',
  email: 'sem@email.com',
  nivel: 'funcionario',
  modulos_permitidos: [],
  status: 'ativo',
  ...over,
});

describe('filtrarUsuarios', () => {
  const usuarios = [
    mkUsuario({ id: '1', nome: 'Carlos Souza', email: 'carlos@x.com', status: 'ativo', tenant_id: 't1' }),
    mkUsuario({ id: '2', nome: 'Ana Beatriz', email: 'ana@x.com', status: 'inativo', tenant_id: 't2' }),
  ];

  it('filtra por nome (case-insensitive)', () => {
    expect(filtrarUsuarios(usuarios, { searchTerm: 'ana', statusFilter: 'todos', tenantFilter: 'all' }).map(u => u.id)).toEqual(['2']);
  });

  it('filtra por e-mail', () => {
    expect(filtrarUsuarios(usuarios, { searchTerm: 'carlos@x.com', statusFilter: 'todos', tenantFilter: 'all' }).map(u => u.id)).toEqual(['1']);
  });

  it('filtra por status', () => {
    expect(filtrarUsuarios(usuarios, { searchTerm: '', statusFilter: 'inativo', tenantFilter: 'all' }).map(u => u.id)).toEqual(['2']);
  });

  it('filtra por empresa (tenant)', () => {
    expect(filtrarUsuarios(usuarios, { searchTerm: '', statusFilter: 'todos', tenantFilter: 't1' }).map(u => u.id)).toEqual(['1']);
  });

  it('combina todos os filtros', () => {
    expect(filtrarUsuarios(usuarios, { searchTerm: 'ana', statusFilter: 'ativo', tenantFilter: 'all' })).toEqual([]);
  });
});

describe('formatAgenciaOuConta', () => {
  it('mantém dígitos, hífen e X, removendo o resto', () => {
    expect(formatAgenciaOuConta('1234-5x')).toBe('1234-5X');
  });

  it('remove espaços e pontuação inválida', () => {
    expect(formatAgenciaOuConta('12.345/6')).toBe('123456');
  });
});

describe('normalizeModulos', () => {
  it('expande para todos os módulos quando a lista está vazia', () => {
    expect(normalizeModulos([])).toEqual(getAllModuleAndSubmoduleIds());
  });

  it('expande para todos os módulos quando é undefined', () => {
    expect(normalizeModulos(undefined)).toEqual(getAllModuleAndSubmoduleIds());
  });

  it('expande quando a lista contém apenas "*"', () => {
    expect(normalizeModulos(['*'])).toEqual(getAllModuleAndSubmoduleIds());
  });

  it('mantém a lista explícita quando não é "todos"', () => {
    expect(normalizeModulos(['associados', 'financeiro'])).toEqual(['associados', 'financeiro']);
  });
});

describe('normalizarModulosParaSalvar', () => {
  it('super_admin sempre grava como "*", mesmo com lista parcial selecionada', () => {
    expect(normalizarModulosParaSalvar('super_admin', ['associados'])).toEqual(['*']);
  });

  it('grava "*" quando todos os módulos/submódulos foram selecionados explicitamente', () => {
    const todos = getAllModuleAndSubmoduleIds();
    expect(normalizarModulosParaSalvar('funcionario', todos)).toEqual(['*']);
  });

  it('mantém a lista explícita quando é uma seleção parcial de um nível não-admin', () => {
    expect(normalizarModulosParaSalvar('funcionario', ['associados'])).toEqual(['associados']);
  });

  it('trata modulos_permitidos ausente como lista vazia', () => {
    expect(normalizarModulosParaSalvar('funcionario', undefined)).toEqual([]);
  });
});
