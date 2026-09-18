/**
 * Acesso às categorias de fornecedor (offline-first, no formato descrito no CLAUDE.md):
 * Supabase quando online, caindo para o IndexedDB quando não.
 *
 * Substitui a lista que vivia no `localStorage` de cada navegador. O filtro por tenant no
 * caminho offline passa por `registroPertenceAoTenant` — é o que faz o cache local aplicar o
 * mesmo critério que a RLS aplica no servidor.
 */
import { supabase, registrarAuditoria } from '../lib/supabase';
import { getAllFromIDB, saveToIDB, getFromIDB } from '../lib/idb';
import { addToSyncQueue } from '../lib/syncService';
import { generateUUID } from '../utils/uuid';
import { registroPertenceAoTenant, tenantDeEscrita, MENSAGEM_TENANT_INDEFINIDO } from '../utils/tenant';
import { CategoriaFornecedorRegistro } from '../types/categoriaFornecedor';
import {
  codigoDeCategoria,
  ordenarCategorias,
  nomeDeCategoriaParaGravacao,
  encontrarCategoriaComMesmoNome,
  MENSAGEM_CATEGORIA_SEM_NOME,
  MENSAGEM_CATEGORIA_DUPLICADA,
} from '../utils/categoriasFornecedor';
import { Fornecedor } from '../types/fornecedores';

const STORE = 'categorias_fornecedor';

const agora = () => new Date().toISOString();

/** Categorias da empresa, ativas e inativas — a tela decide o que mostrar. */
export const getCategoriasFornecedor = async (
  isOnline: boolean,
  tenantId?: string | null,
): Promise<CategoriaFornecedorRegistro[]> => {
  if (isOnline) {
    try {
      let query = supabase.from(STORE).select('*').is('deleted_at', null);
      if (tenantId && tenantId !== 'all') query = query.eq('tenant_id', tenantId);

      const { data, error } = await query.order('nome', { ascending: true });
      if (!error && data) {
        for (const categoria of data) await saveToIDB(STORE, categoria);
        return ordenarCategorias(data);
      }
    } catch (err) {
      console.warn('Falha ao buscar categorias de fornecedor no Supabase, caindo para o IDB:', err);
    }
  }

  const locais = await getAllFromIDB<CategoriaFornecedorRegistro>(STORE);
  return ordenarCategorias(
    locais.filter((c) => !c.deleted_at && registroPertenceAoTenant(c.tenant_id, tenantId)),
  );
};

/**
 * Propaga o nome novo para os fornecedores que apontam para a categoria.
 *
 * **`fornecedores.categoria` não é snapshot** — ao contrário de `despesas.centro_custo` e do
 * `categoria` dos lançamentos, que congelam o que valia na época porque são documento
 * histórico. Aqui é classificação operacional: a categoria renomeada tem de aparecer com o
 * nome de hoje na listagem, no filtro e no relatório. Quem manda é `categoria_id`; o texto
 * acompanha, e acompanha **num lugar só** — senão as duas metades divergem na primeira
 * renomeação, que é a doença que este schema já registrou três vezes.
 */
const propagarNomeParaFornecedores = async (
  isOnline: boolean,
  categoria: CategoriaFornecedorRegistro,
): Promise<void> => {
  if (isOnline) {
    const { error } = await supabase
      .from('fornecedores')
      .update({ categoria: categoria.nome, updated_at: agora() })
      .eq('tenant_id', categoria.tenant_id)
      .eq('categoria_id', categoria.id);
    // A recusa aqui não desfaz a renomeação, que já foi gravada: avisa e deixa o nome antigo
    // nos fornecedores, que é um estado visível e corrigível — ao contrário de falhar inteiro
    // e deixar o operador sem saber o que aconteceu com a categoria.
    if (error) throw new Error(`Categoria renomeada, mas os fornecedores não puderam ser atualizados: ${error.message}`);
  }

  const locais = await getAllFromIDB<Fornecedor>('fornecedores');
  for (const f of locais) {
    if ((f as { categoria_id?: string }).categoria_id === categoria.id) {
      await saveToIDB('fornecedores', { ...f, categoria: categoria.nome, updated_at: agora() });
    }
  }
};

/**
 * Cria ou renomeia uma categoria.
 *
 * O código é derivado do nome na criação e **nunca reescrito** depois: é por ele que quem
 * exportou relatório reconhece a categoria, e mudá-lo numa renomeação quebraria essa
 * correspondência sem nenhum aviso. Mesma decisão de `salvarCentroCusto`.
 */
export const salvarCategoriaFornecedor = async (
  isOnline: boolean,
  categoria: Partial<CategoriaFornecedorRegistro>,
  categoriasConhecidas: readonly CategoriaFornecedorRegistro[] = [],
): Promise<CategoriaFornecedorRegistro> => {
  const tenantId = tenantDeEscrita(categoria.tenant_id);
  if (!tenantId) throw new Error(MENSAGEM_TENANT_INDEFINIDO);

  const nome = nomeDeCategoriaParaGravacao(categoria.nome);
  if (!nome) throw new Error(MENSAGEM_CATEGORIA_SEM_NOME);

  if (encontrarCategoriaComMesmoNome(categoriasConhecidas, nome, categoria.id)) {
    throw new Error(MENSAGEM_CATEGORIA_DUPLICADA);
  }

  const existente = categoria.id ? await getFromIDB<CategoriaFornecedorRegistro>(STORE, categoria.id) : null;
  const renomeou = Boolean(existente && existente.nome !== nome);

  const registro: CategoriaFornecedorRegistro = {
    ...(existente || {}),
    ...categoria,
    id: categoria.id || generateUUID(),
    tenant_id: tenantId,
    codigo: (existente?.codigo || categoria.codigo || codigoDeCategoria(nome)).trim(),
    nome,
    ativo: categoria.ativo !== undefined ? categoria.ativo : (existente?.ativo ?? true),
    criado_em: existente?.criado_em || agora(),
    atualizado_em: agora(),
  } as CategoriaFornecedorRegistro;

  await saveToIDB(STORE, registro);

  if (isOnline) {
    const { error } = await supabase.from(STORE).upsert(registro, { onConflict: 'id' });
    if (error) {
      await addToSyncQueue({ storeName: STORE, action: 'update', data: registro });
      throw new Error(`Erro ao salvar categoria: ${error.message}`);
    }
    await registrarAuditoria(existente ? 'Editar Categoria de Fornecedor' : 'Criar Categoria de Fornecedor', {
      id: registro.id,
      nome: registro.nome,
    });
  } else {
    await addToSyncQueue({ storeName: STORE, action: 'update', data: registro });
  }

  if (renomeou) await propagarNomeParaFornecedores(isOnline, registro);

  return registro;
};

/**
 * Desativa em vez de excluir — o fornecedor que já aponta para a categoria continua válido, e
 * a FK é `ON DELETE RESTRICT` de qualquer forma. Mesma decisão de `desativarCentroCusto`: a
 * categoria some do seletor de cadastro novo sem tocar em quem já a usa.
 */
export const desativarCategoriaFornecedor = async (
  isOnline: boolean,
  categoria: CategoriaFornecedorRegistro,
): Promise<CategoriaFornecedorRegistro> =>
  salvarCategoriaFornecedor(isOnline, { ...categoria, ativo: false });

export const reativarCategoriaFornecedor = async (
  isOnline: boolean,
  categoria: CategoriaFornecedorRegistro,
): Promise<CategoriaFornecedorRegistro> =>
  salvarCategoriaFornecedor(isOnline, { ...categoria, ativo: true });
