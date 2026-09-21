import { describe, it, expect } from 'vitest';
import {
  rotulosDeFiltro,
  linhasDoRelatorio,
  operadorEmTresLinhas,
  montarCsvDeAuditoria,
  CABECALHO_CSV,
} from './relatorioAuditoria';
import type { LogAuditoria } from '../services/auditoriaService';

const log = (over: Partial<LogAuditoria> = {}): LogAuditoria => ({
  id: 'log-1',
  tenant_id: 'emp-1',
  usuario_id: 'u1',
  acao: 'Criar Associado',
  detalhes: { nome: 'MARIA', cpf: '046.537.031-40' },
  created_at: '2026-09-20T15:30:00.000Z',
  usuarios: { nome: 'ADMIN PAX', email: 'admin@exemplo.local', nivel: 'admin' },
  ...over,
});

const EMPRESAS = [{ id: 'emp-1', nome_fantasia: 'PAX Homologacao' }];

const SEM_FILTRO_NENHUM = {
  dataInicio: '',
  dataFim: '',
  moduloFiltro: 'todos',
  tipoAcaoFiltro: 'todos' as const,
  usuarioFiltro: 'todos',
};

// ============================================================================
// Os rótulos do cabeçalho
// ============================================================================

describe('rotulosDeFiltro', () => {
  it('sem período escolhido, diz "Histórico Completo" em vez de deixar em branco', () => {
    // Um relatório que não diz por qual filtro foi gerado afirma ser a lista completa sem
    // ser — o rótulo é conteúdo, não enfeite.
    expect(rotulosDeFiltro(SEM_FILTRO_NENHUM, []).periodo).toBe('Histórico Completo');
  });

  it('com só uma ponta da data, nomeia a outra em vez de imprimir vazio', () => {
    expect(rotulosDeFiltro({ ...SEM_FILTRO_NENHUM, dataInicio: '2026-09-01' }, []).periodo)
      .toBe('01/09/2026 até Hoje');
    expect(rotulosDeFiltro({ ...SEM_FILTRO_NENHUM, dataFim: '2026-09-30' }, []).periodo)
      .toBe('Início até 30/09/2026');
  });

  it('a data vem do TEXTO, com meio-dia — 1º de janeiro não vira 31 de dezembro', () => {
    // `new Date('2026-01-01')` é meia-noite UTC, que em UTC-3 é 31/12/2025. É a armadilha
    // que o CLAUDE.md documenta em `anoDaData()`.
    const r = rotulosDeFiltro(
      { ...SEM_FILTRO_NENHUM, dataInicio: '2026-01-01', dataFim: '2026-01-01' },
      [],
    );
    expect(r.periodo).toBe('01/01/2026 até 01/01/2026');
  });

  it('resolve o operador por id OU por e-mail', () => {
    // `getLogsAuditoria` indexa o mapa de usuários pelos dois, então o filtro carrega
    // qualquer um deles. Olhar só o id imprimia um uuid cru no cabeçalho.
    const usuarios = [{ id: 'u1', nome: 'ADMIN PAX', email: 'admin@exemplo.local' }];
    expect(rotulosDeFiltro({ ...SEM_FILTRO_NENHUM, usuarioFiltro: 'u1' }, usuarios).operador)
      .toBe('ADMIN PAX (admin@exemplo.local)');
    expect(
      rotulosDeFiltro({ ...SEM_FILTRO_NENHUM, usuarioFiltro: 'admin@exemplo.local' }, usuarios).operador,
    ).toBe('ADMIN PAX (admin@exemplo.local)');
  });

  it('operador desconhecido imprime o próprio valor, em vez de sumir', () => {
    expect(rotulosDeFiltro({ ...SEM_FILTRO_NENHUM, usuarioFiltro: 'u-fantasma' }, []).operador)
      .toBe('u-fantasma');
  });

  it('"sistema" tem rótulo próprio — não é um operador que sumiu', () => {
    expect(rotulosDeFiltro({ ...SEM_FILTRO_NENHUM, usuarioFiltro: 'sistema' }, []).operador)
      .toBe('Sistema (Automações)');
  });

  it('módulo e tipo sem filtro dizem "todos", com filtro vão em caixa alta', () => {
    const r = rotulosDeFiltro(
      { ...SEM_FILTRO_NENHUM, moduloFiltro: 'associados', tipoAcaoFiltro: 'delete' },
      [],
    );
    expect(r.modulo).toBe('ASSOCIADOS');
    expect(r.tipo).toBe('DELETE');
  });
});

// ============================================================================
// As linhas, que as três saídas leem
// ============================================================================

describe('linhasDoRelatorio', () => {
  it('numera a partir de 1 e resolve empresa, operador e papel', () => {
    const [linha] = linhasDoRelatorio([log()], EMPRESAS);
    expect(linha.indice).toBe(1);
    expect(linha.empresa).toBe('PAX Homologacao');
    expect(linha.operadorNome).toBe('ADMIN PAX');
    expect(linha.operadorPapel).toBe('Administrador');
  });

  it('empresa não encontrada cai para o tenant cru, não para vazio', () => {
    // A linha de `tenant_id = 'system'` é justamente a que não tem empresa — e ela precisa
    // continuar identificável no relatório do super_admin.
    const [linha] = linhasDoRelatorio([log({ tenant_id: 'system' })], EMPRESAS);
    expect(linha.empresa).toBe('system');
  });

  it('log sem usuário vira "Sistema", e o papel não fica em branco', () => {
    const [linha] = linhasDoRelatorio([log({ usuarios: undefined })], EMPRESAS);
    expect(linha.operadorNome).toBe('Sistema');
    expect(linha.operadorEmail).toBe('N/A');
  });

  it('MASCARA o CPF no texto dos detalhes — e só ali, não no JSON bruto', () => {
    // As duas colunas existem para coisas diferentes: `detalhes` é o texto que vai ao papel
    // e é mascarado; `detalhesBrutos` é o payload como está gravado, que é o que a coluna
    // "JSON Bruto" existe para entregar.
    const [linha] = linhasDoRelatorio([log()], EMPRESAS);
    expect(linha.detalhes).toContain('***.537.031-**');
    expect(linha.detalhes).not.toContain('046.537.031-40');
    expect(linha.detalhesBrutos).toContain('046.537.031-40');
  });

  it('a célula do operador do PDF deriva da linha, nunca do log de novo', () => {
    const [linha] = linhasDoRelatorio([log()], EMPRESAS);
    expect(operadorEmTresLinhas(linha)).toBe('ADMIN PAX\n(Administrador)\nadmin@exemplo.local');
  });
});

// ============================================================================
// O CSV
// ============================================================================

describe('montarCsvDeAuditoria', () => {
  it('abre com o BOM — sem ele o Excel em pt-BR quebra todo acento', () => {
    expect(montarCsvDeAuditoria([log()], EMPRESAS).startsWith('﻿')).toBe(true);
  });

  it('tem uma linha por log mais o cabeçalho, com as 10 colunas', () => {
    const csv = montarCsvDeAuditoria([log(), log({ id: 'log-2' })], EMPRESAS);
    const linhas = csv.replace('﻿', '').split('\r\n');
    expect(linhas).toHaveLength(3);
    expect(linhas[0].split(';')).toHaveLength(CABECALHO_CSV.length);
  });

  it('escapa as aspas em vez de quebrar a coluna', () => {
    const csv = montarCsvDeAuditoria([log({ acao: 'Ação com "aspas"' })], EMPRESAS);
    expect(csv).toContain('"Ação com ""aspas"""');
  });

  it('o CSV e o PDF leem a MESMA linha — é o que os impede de divergir', () => {
    // Antes da extração, o CSV chamava o log sem usuário de "Desconhecido" e o PDF de
    // "Sistema": duas saídas do mesmo relatório, discordando sobre quem fez a ação.
    const semUsuario = log({ usuarios: undefined });
    const [linha] = linhasDoRelatorio([semUsuario], EMPRESAS);
    const csv = montarCsvDeAuditoria([semUsuario], EMPRESAS);
    expect(csv).toContain(`"${linha.operadorNome}"`);
    expect(operadorEmTresLinhas(linha)).toContain(linha.operadorNome);
  });
});
