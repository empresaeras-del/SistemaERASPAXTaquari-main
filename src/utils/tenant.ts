/**
 * Resolução do tenant (empresa) de um registro.
 *
 * ## O duplo sentido que este módulo existe para desfazer
 *
 * Historicamente, `'default_tenant'` e `'empresa_padrao'` tinham dois significados ao
 * mesmo tempo, e eles se contradiziam:
 *
 * - **No banco**, `has_tenant_access()` — a função que toda policy RLS do schema usa —
 *   devolvia verdadeiro para esses dois valores independentemente de quem chamava.
 *   Significavam *"registro global, compartilhado entre todas as empresas"*.
 * - **No frontend**, eram usados como *fallback de empresa não selecionada*:
 *   `state.empresaSelecionada || 'empresa_padrao'`.
 *
 * Somados, um registro criado sem empresa escolhida nascia legível **e gravável** por
 * todas as empresas do sistema, sem erro, sem aviso e sem nada visível na tela. Só um
 * super_admin chega nesse estado (para os demais níveis o `AppContext` força
 * `empresaSelecionada = user.tenant_id`), o que tornava o problema ainda mais silencioso:
 * quem criava o registro enxergava tudo de qualquer forma.
 *
 * A partir daqui: escrita nunca carimba um valor coringa. Quando não há empresa
 * definida, `tenantDeEscrita` devolve `null` e o chamador **recusa a operação** em vez de
 * adivinhar — é a diferença entre um erro visível na hora e um vazamento silencioso.
 *
 * A migration `20260908_*_has_tenant_access_sem_tenants_coringa` remove o outro lado:
 * os dois valores deixam de ser coringa no banco.
 */

/**
 * Os dois valores que eram gravados como "empresa desconhecida" e lidos como "de todo
 * mundo". Continuam listados para que o código saiba **reconhecê-los** em dado legado —
 * nunca para gravá-los.
 */
export const TENANTS_LEGADOS_CORINGA = ['default_tenant', 'empresa_padrao'] as const;

/**
 * Sentinela de *ausência de filtro por tenant*, usada pelos services e pelo seletor de
 * empresa das telas administrativas. Nunca é o tenant de um registro.
 */
export const TENANT_SEM_FILTRO = 'all';

/** Mensagem única para quando não dá para determinar a empresa de um registro novo. */
export const MENSAGEM_TENANT_INDEFINIDO =
  'Selecione a empresa no topo da tela antes de salvar — o registro precisa pertencer a uma empresa.';

const normalizar = (valor?: string | null): string => (valor ?? '').trim();

/** `true` para os valores que antes atravessavam a fronteira entre empresas. */
export const ehTenantCoringaLegado = (valor?: string | null): boolean =>
  (TENANTS_LEGADOS_CORINGA as readonly string[]).includes(normalizar(valor));

/**
 * `true` quando o valor identifica **uma** empresa: não é vazio, não é o sentinela de
 * "sem filtro" e não é um dos coringas legados.
 */
export const ehTenantUtilizavel = (valor?: string | null): boolean => {
  const v = normalizar(valor);
  return v !== '' && v !== TENANT_SEM_FILTRO && !ehTenantCoringaLegado(v);
};

/**
 * Tenant com que um registro novo deve ser gravado.
 *
 * Ordem: a empresa selecionada na tela; senão a empresa do próprio usuário (que é o dono
 * natural do registro); senão `null`.
 *
 * `null` **não é um erro deste módulo** — é a resposta correta para "um super_admin não
 * escolheu empresa nenhuma". Quem chama deve interromper a gravação e pedir a escolha,
 * usando `MENSAGEM_TENANT_INDEFINIDO`.
 */
export const tenantDeEscrita = (
  empresaSelecionada?: string | null,
  usuarioTenantId?: string | null,
): string | null => {
  if (ehTenantUtilizavel(empresaSelecionada)) return normalizar(empresaSelecionada);
  if (ehTenantUtilizavel(usuarioTenantId)) return normalizar(usuarioTenantId);
  return null;
};

/**
 * Um registro pertence ao tenant filtrado?
 *
 * Usada no caminho offline dos services, para filtrar o que veio do IndexedDB com o mesmo
 * critério que a RLS aplica no Supabase. Antes, cada service repetia à mão uma lista que
 * incluía `'default_tenant'` e `'empresa_padrao'` — a metade cliente do mesmo duplo
 * sentido: um registro coringa passava no filtro de qualquer empresa.
 *
 * Registro sem tenant continua passando: é o catálogo compartilhado (`procedimentos`),
 * que o banco trata com uma cláusula própria por tabela (`tenant_id IS NULL OR ...`) — a
 * forma correta de declarar "isto é global", em vez de um valor mágico em `tenant_id`.
 */
export const registroPertenceAoTenant = (
  tenantDoRegistro: string | null | undefined,
  tenantFiltrado?: string | null,
): boolean => {
  if (!ehTenantUtilizavel(tenantFiltrado)) return true; // 'all'/vazio = sem filtro
  const doRegistro = normalizar(tenantDoRegistro);
  if (doRegistro === '') return true; // catálogo compartilhado
  return doRegistro === normalizar(tenantFiltrado);
};

/**
 * Tenant de um registro que **já existe**, para quando é preciso reaproveitar o dele.
 * Ignora valor coringa legado gravado antes desta correção e cai para a resolução normal.
 */
export const tenantDeRegistroExistente = (
  tenantDoRegistro?: string | null,
  empresaSelecionada?: string | null,
  usuarioTenantId?: string | null,
): string | null => {
  if (ehTenantUtilizavel(tenantDoRegistro)) return normalizar(tenantDoRegistro);
  return tenantDeEscrita(empresaSelecionada, usuarioTenantId);
};
