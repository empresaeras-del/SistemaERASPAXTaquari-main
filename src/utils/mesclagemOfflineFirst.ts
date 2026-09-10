/**
 * Mesclagem entre o que veio do Supabase e o que está no IndexedDB — e, principalmente,
 * como distinguir "criado offline, ainda não sincronizado" de "excluído em outra sessão".
 *
 * ## O bug que esta função existe para corrigir
 *
 * O merge anterior preservava todo registro local ausente na resposta remota:
 *
 * ```ts
 * if (!remoteMap.has(localItem.id) && !localItem.deleted_at) remoteMap.set(localItem.id, localItem);
 * ```
 *
 * A intenção estava certa — um registro criado offline não pode sumir da tela só porque o
 * servidor ainda não o conhece. Mas **"ausente no servidor" é indistinguível de "excluído no
 * servidor"**, e as exclusões deste sistema são *hard delete* (`excluirReceita` faz
 * `.delete()`, sem deixar lápide). Resultado real, observado em 10/09/2026: a receita
 * `50be9316` foi excluída pelo app às 01:16, e continuou aparecendo — com as 12 parcelas
 * dela — em toda sessão cujo IndexedDB ainda a tinha. O navegador que excluiu limpou o
 * próprio cache; os outros nunca souberam.
 *
 * Pior que exibir errado: `atualizarReceita` faz `upsert`, e upsert de linha inexistente é
 * **INSERT**. Uma sessão com cache velho podia **reinserir no banco** o registro excluído, e
 * então ele voltava para todo mundo.
 *
 * ## A correção: a fila de sync é quem sabe
 *
 * Um registro local ausente no servidor só é preservado se tiver **tarefa pendente na fila de
 * sync**. É a única fonte que sabe a diferença: ela existe exatamente para guardar o que
 * ainda não subiu. Sem tarefa pendente, o registro foi excluído em outro lugar — sai da lista
 * e sai do IndexedDB, então o cache **se cura sozinho** no próximo carregamento online.
 *
 * ## Duas salvaguardas que impedem a correção de virar perda de dado
 *
 * 1. **Só rode isto quando a busca remota deu certo.** Se o Supabase falhou, "ausente no
 *    servidor" não significa nada e podar apagaria o cache inteiro. Quem chama é responsável
 *    por invocar só no caminho de sucesso — ver os `getX` de `financeiroService.ts`.
 * 2. **A poda respeita o tenant da consulta.** A consulta remota filtra por empresa, então
 *    registro de OUTRA empresa está legitimamente ausente da resposta. Podá-lo apagaria o
 *    cache da outra empresa ao trocar de empresa na tela. Só entra na poda o registro que
 *    pertence ao tenant consultado.
 */
import { registroPertenceAoTenant } from './tenant';

/** O mínimo que um registro precisa ter para participar da mesclagem. */
export interface RegistroSincronizavel {
  id: string;
  tenant_id?: string | null;
  deleted_at?: string | null;
}

export interface ResultadoMesclagem<T> {
  /** O que a tela deve exibir: remotos + locais legitimamente pendentes. */
  registros: T[];
  /**
   * Ids que existiam só no cache, sem tarefa pendente e do tenant consultado — ou seja,
   * excluídos em outra sessão. Quem chama remove do IndexedDB.
   */
  orfaosParaRemover: string[];
}

/**
 * Ids com tarefa pendente na fila, para um store específico.
 *
 * Filtra por `storeName` de propósito: um id preso na fila de `despesas` não deve preservar
 * um registro de `receitas`. Com UUID a colisão é improvável, mas a regra correta é barata.
 */
export function idsPendentesDeSync(
  fila: Array<{ storeName?: string; data?: unknown }>,
  storeName: string,
): Set<string> {
  const ids = new Set<string>();
  for (const tarefa of fila || []) {
    if (!tarefa || tarefa.storeName !== storeName) continue;
    const dado = tarefa.data as { id?: unknown } | string | null | undefined;
    const id = typeof dado === 'string' ? dado : dado?.id;
    if (typeof id === 'string' && id !== '') ids.add(id);
  }
  return ids;
}

/**
 * Mescla remoto com local, preservando só o local que a fila de sync justifica.
 *
 * **Chame apenas quando a busca remota tiver sucedido** — ver a salvaguarda 1 no topo.
 */
export function mesclarComCacheLocal<T extends RegistroSincronizavel>(params: {
  remotos: T[];
  locais: T[];
  pendentesDeSync: Set<string>;
  /** Tenant usado na consulta remota. `'all'`/vazio = consulta sem filtro de empresa. */
  tenantDaConsulta?: string | null;
}): ResultadoMesclagem<T> {
  const { remotos, locais, pendentesDeSync, tenantDaConsulta } = params;

  const porId = new Map<string, T>();
  for (const remoto of remotos || []) {
    if (remoto?.id) porId.set(remoto.id, remoto);
  }

  const orfaosParaRemover: string[] = [];

  for (const local of locais || []) {
    if (!local?.id) continue;
    if (porId.has(local.id)) continue;        // veio do servidor: o remoto manda
    if (local.deleted_at) continue;           // já excluído logicamente, não exibe nem poda

    if (pendentesDeSync.has(local.id)) {
      porId.set(local.id, local);             // criado/editado offline: preserva
      continue;
    }

    // Ausente no servidor e sem nada pendente. Só é órfão se o servidor DEVERIA tê-lo
    // devolvido — isto é, se ele pertence ao tenant que foi consultado (salvaguarda 2).
    if (registroPertenceAoTenant(local.tenant_id, tenantDaConsulta)) {
      orfaosParaRemover.push(local.id);
    } else {
      porId.set(local.id, local);             // outra empresa: fora do escopo desta consulta
    }
  }

  return { registros: Array.from(porId.values()), orfaosParaRemover };
}
