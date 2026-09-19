import { supabase, registrarAuditoria } from '../lib/supabase';
import { RecusaDoServidor, explicarRecusa } from '../utils/recusaDoServidor';
import { registroPertenceAoTenant, tenantDeEscrita, MENSAGEM_TENANT_INDEFINIDO } from '../utils/tenant';
import { mesclarComCacheLocal, idsPendentesDeSync } from '../utils/mesclagemOfflineFirst';
import { getFromIDB, saveToIDB, getAllFromIDB, deleteFromIDB } from '../lib/idb';
import { addToSyncQueue, getSyncQueue } from '../lib/syncService';
import { cancelarParcelasEmAbertoDoAssociado } from './financeiroService';
import {
  HistoricoImpeditivo,
  MENSAGEM_EXCLUSAO_BLOQUEADA,
  montarHistoricoImpeditivo,
} from '../utils/historicoAssociado';
import { vinculoEmpresaParaGravacao } from '../utils/empresaVinculada';
import { statusDoContratoParaAssociado } from '../utils/statusContrato';

export interface Associado {
  id: string;
  tenant_id: string;
  nome: string;
  cpf: string;
  data_nascimento?: string;
  rg?: string;
  sexo?: string;
  nome_pai?: string;
  nome_mae?: string;
  telefone?: string;
  email?: string;
  endereco_logradouro?: string;
  endereco_numero?: string;
  endereco_bairro?: string;
  endereco_cidade?: string;
  endereco_cep?: string;
  endereco_estado?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  municipio?: string;
  cep?: string;
  uf?: string;
  plano_id?: string;
  tipo_pessoa?: 'PF' | 'PJ';
  empresa_id?: string;
  celular_whatsapp?: string;
  tipo_associado?: 'titular' | 'dependente';
  estado_civil?: string;
  profissao?: string;
  observacoes?: string;
  fornecedor_id?: string;
  plano_pax_id?: string;
  numero_contrato?: string;
  n_vidas?: number;
  plano_nome?: string;
  documentos?: DocumentoAssociado[];
  valor_plano?: number;
  assinatura_base64?: string;
  historico_contratos?: { id: string; plano: string; valor: number; data_inicio: string; data_fim?: string }[];
  status: 'ativo' | 'inativo' | 'inadimplente' | 'encerrado';
  created_at?: string;
  deleted_at?: string | null;
  data_adesao: string;
  dependentes: Dependente[];
}

export interface Dependente {
  id: string;
  nome: string;
  cpf?: string;
  data_nascimento?: string;
  parentesco: string;
  /**
   * A coluna já existia no Postgres (default `'ativo'`) mas faltava aqui — e o payload de
   * gravação também não a mandava, então inativar um dependente não tinha onde ficar
   * guardado. Ausente significa ativo, que é o estado de todo dependente anterior a esta
   * mudança.
   */
  status?: 'ativo' | 'inativo';
}

const STORE_NAME = 'associados';

export const getAssociados = async (isOnline: boolean, tenantId: string | null): Promise<Associado[]> => {
  let associados: Associado[] = [];
  const localAssociados = await getAllFromIDB<Associado>(STORE_NAME);

  if (isOnline) {
    try {
      let data: any[] | null = null;

      // 1. Tenta buscar associados com dependentes em join
      try {
        let query = supabase
          .from('associados')
          .select('*, dependentes(*)')
          .is('deleted_at', null);
        if (tenantId && tenantId !== 'all') {
          query = query.or(`tenant_id.eq.${tenantId},empresa_id.eq.${tenantId}`);
        }
        const res = await query;
        if (!res.error && res.data && res.data.length > 0) {
          data = res.data;
        }
      } catch (e) {
        // Fallback para queries separadas
      }

      // 2. Se join não retornou dados, busca direto da tabela associados e anexa dependentes
      if (!data) {
        let query = supabase
          .from('associados')
          .select('*')
          .is('deleted_at', null);
        if (tenantId && tenantId !== 'all') {
          query = query.or(`tenant_id.eq.${tenantId},empresa_id.eq.${tenantId}`);
        }
        const res = await query;
        if (!res.error && res.data && res.data.length > 0) {
          const assocData = res.data;
          const assocIds = assocData.map(a => a.id);
          try {
            const { data: depsData } = await supabase
              .from('dependentes')
              .select('*')
              .in('associado_id', assocIds);
            
            const depsMap = new Map<string, Dependente[]>();
            (depsData || []).forEach((d: any) => {
              const list = depsMap.get(d.associado_id) || [];
              list.push(d);
              depsMap.set(d.associado_id, list);
            });

            data = assocData.map(a => ({
              ...a,
              dependentes: depsMap.get(a.id) || a.dependentes || []
            }));
          } catch (dErr) {
            data = assocData.map(a => ({
              ...a,
              dependentes: a.dependentes || []
            }));
          }
        }
      }

      // Se obtivemos dados do Supabase, sincroniza para IDB
      if (data && data.length > 0) {
        for (const item of data) {
          await saveToIDB(STORE_NAME, item);
        }
        
        // Preserva o local ausente no servidor SÓ quando a fila de sync justifica; o resto
        // foi excluído em outra sessão e é removido do cache (ver mesclagemOfflineFirst.ts).
        const normalizados: Associado[] = (data as any[]).map((item: any) => ({
          ...item,
          dependentes: Array.isArray(item.dependentes) ? item.dependentes : []
        }));

        const mesclagem = mesclarComCacheLocal<Associado>({
          remotos: normalizados,
          locais: localAssociados || [],
          pendentesDeSync: idsPendentesDeSync(await getSyncQueue(), STORE_NAME),
          tenantDaConsulta: tenantId,
        });
        for (const orfaoId of mesclagem.orfaosParaRemover) {
          await deleteFromIDB(STORE_NAME, orfaoId);
        }

        associados = mesclagem.registros;
      } else {
        // Se Supabase retornou vazio ou erro silencioso por RLS, usa IDB local
        associados = localAssociados;
      }
    } catch (error) {
      console.warn('Supabase fetch failed, falling back to IDB:', error);
      associados = localAssociados;
    }
  } else {
    associados = localAssociados;
  }

  // Normalização e filtragem por tenant_id
  return (associados || []).filter(a => {
    if (!a) return false;
    if (a.deleted_at) return false;
    if (tenantId && tenantId !== 'all') {
      const matchTenant = registroPertenceAoTenant(a.tenant_id, tenantId) ||
        (a as any).empresa_id === tenantId;
      if (!matchTenant) return false;
    }
    return true;
  }).map(a => {
    const logr = a.endereco_logradouro || a.logradouro || '';
    const num = a.endereco_numero || a.numero || '';
    const bai = a.endereco_bairro || a.bairro || '';
    const cid = a.endereco_cidade || a.cidade || (a as any).municipio || '';
    const cepVal = a.endereco_cep || a.cep || '';
    const ufVal = a.endereco_estado || a.uf || '';

    return {
      ...a,
      endereco_logradouro: logr,
      logradouro: logr,
      endereco_numero: num,
      numero: num,
      endereco_bairro: bai,
      bairro: bai,
      endereco_cidade: cid,
      cidade: cid,
      municipio: cid,
      endereco_cep: cepVal,
      cep: cepVal,
      endereco_estado: ufVal,
      uf: ufVal,
      dependentes: Array.isArray(a.dependentes) ? a.dependentes : []
    };
  });
};


export { RecusaDoServidor };

/**
 * Faz o upsert e **lança** quando o Postgres recusa. Uma tentativa, um payload.
 *
 * Substitui `resilientSupabaseUpsert`, que tentava até 8 vezes e **mudava o payload a cada
 * tentativa** até o banco aceitar: removia a coluna que o `PGRST204` apontava, anulava o
 * `plano_pax_id` quando a FK falhava, e removia o `empresa_id`. As três "recuperações"
 * gravavam um registro diferente do que o operador preencheu, com a tela dizendo "salvo com
 * sucesso" e só um `console.warn` como testemunha.
 *
 * A pior delas era a FK: o associado era gravado **sem plano**, e o valor da mensalidade
 * perdia a base de cálculo. O plano some do cadastro e nada na tela explica por quê.
 *
 * **É exatamente o padrão que este repositório já removeu de `criarRequisicao`** em
 * 11/09/2026 (o retry que regravava a guia com `status: 'pendente'`), e que o CLAUDE.md
 * classifica desde então: *um retry que muda o dado enviado não é tolerância a falha — é
 * corromper o registro para conseguir gravá-lo.* Se o servidor recusou, ou o payload está
 * errado (corrija o payload) ou a constraint está errada (corrija a constraint).
 *
 * A função nasceu como defesa contra o schema drift — o período em que o TypeScript
 * declarava campos que o banco não tinha. Esse período acabou em 15/09/2026: as colunas
 * duplicadas foram dropadas, as migrations estão rastreadas, e a regra "campo novo, migration
 * na mesma tarefa" já vale. O que restava era uma rede que só escondia o próximo defeito —
 * e `PGRST204` é justamente o **único sinal** de que ele existe.
 *
 * Continua valendo a distinção que o CLAUDE.md fixa: **recusa do Postgres e queda de rede
 * não terminam igual**. Esta função trata a recusa (`error` devolvido pelo cliente) e lança;
 * a exceção de rede sobe do `await` e é o `catch` do chamador que a manda para o IndexedDB e
 * para a fila de sync.
 */
export async function upsertOuFalhar(
  tableName: string,
  data: Record<string, any>,
  onConflict: string = 'id',
): Promise<any> {
  const { data: resData, error } = await supabase
    .from(tableName)
    .upsert(data, { onConflict });

  if (error) throw new RecusaDoServidor(explicarRecusa(tableName, error));
  return resData;
}

export const saveAssociado = async (associado: Associado, isOnline: boolean): Promise<void> => {
  const existing = await getFromIDB<Associado>(STORE_NAME, associado.id);
  
  // Extrai dependentes, que vivem em tabela própria.
  //
  // `fornecedor_id` SAIA daqui: até 17/09/2026 ele era desestruturado junto e nunca chegava ao
  // Postgres — o operador escolhia a empresa conveniada do associado PJ, a tela dizia "salvo com
  // sucesso" e o vínculo não existia. A coluna passou a existir na migration
  // 20260917193736_associado_pj_vinculo_fornecedor.
  const { dependentes, ...rest } = associado as any;

  // Garante que o ID do associado é um UUID válido
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const associadoId = UUID_REGEX.test(associado.id) ? associado.id : crypto.randomUUID();

  // Sem empresa resolvida o associado não tem dono. O fallback antigo era
  // `'default_tenant'`, que a RLS lia como "de todas as empresas" — ver utils/tenant.ts.
  const tenantId = tenantDeEscrita(rest.tenant_id);
  if (!tenantId) {
    throw new Error(`Não foi possível determinar a empresa do associado. ${MENSAGEM_TENANT_INDEFINIDO}`);
  }
  const empresaId = (rest.empresa_id && rest.empresa_id !== 'all') 
    ? rest.empresa_id 
    : tenantId;

  const planoPaxId = rest.plano_pax_id && UUID_REGEX.test(rest.plano_pax_id) ? rest.plano_pax_id : null;

  const dataNascimento = (rest.data_nascimento && String(rest.data_nascimento).trim() !== '') 
    ? String(rest.data_nascimento).split('T')[0] 
    : null;

  const dataAdesao = (rest.data_adesao && String(rest.data_adesao).trim() !== '') 
    ? String(rest.data_adesao).split('T')[0] 
    : new Date().toISOString().split('T')[0];

  const valorPlano = (rest.valor_plano !== undefined && rest.valor_plano !== null && !isNaN(Number(rest.valor_plano)))
    ? Number(rest.valor_plano)
    : null;

  const nVidas = Number(rest.n_vidas) || (1 + (Array.isArray(dependentes) ? dependentes.length : 0));

  const associadoToSave: Associado = {
    ...associado,
    id: associadoId,
    tenant_id: tenantId,
    empresa_id: empresaId,
    plano_pax_id: planoPaxId || undefined,
    data_nascimento: dataNascimento || undefined,
    data_adesao: dataAdesao,
    valor_plano: valorPlano ?? undefined,
    n_vidas: nVidas,
    // Normaliza também a cópia local: cache e servidor divergindo aqui faria o filtro por empresa
    // dar respostas diferentes conforme a busca remota tivesse funcionado ou não.
    fornecedor_id: vinculoEmpresaParaGravacao(rest.tipo_pessoa, rest.fornecedor_id) ?? undefined,
    dependentes: Array.isArray(dependentes) ? dependentes : []
  } as any;

  // 1. Sempre grava imediatamente no IndexedDB para persistência offline/local
  await saveToIDB(STORE_NAME, associadoToSave);

  // Sincroniza store 'dependentes' do IndexedDB
  try {
    const localDeps = await getAllFromIDB<any>('dependentes');
    const currentDepIds = new Set((associadoToSave.dependentes || []).map((d: any) => d.id).filter(Boolean));
    for (const d of localDeps) {
      if (d.associado_id === associadoId && !currentDepIds.has(d.id)) {
        await deleteFromIDB('dependentes', d.id);
      }
    }
    if (Array.isArray(associadoToSave.dependentes)) {
      for (const d of associadoToSave.dependentes) {
        await saveToIDB('dependentes', {
          ...d,
          associado_id: associadoId,
          tenant_id: tenantId,
          empresa_id: empresaId
        });
      }
    }
  } catch (idbErr) {
    console.warn('Erro ao atualizar dependentes no IDB:', idbErr);
  }

  if (isOnline) {
    try {
      // 2. Pré-sincroniza o plano_pax caso exista e não esteja presente no Supabase (evita erro de FK)
      if (planoPaxId) {
        try {
          const { data: planoInSupabase } = await supabase
            .from('planos_pax')
            .select('id')
            .eq('id', planoPaxId)
            .maybeSingle();

          if (!planoInSupabase) {
            const localPlano = await getFromIDB<any>('planos_pax', planoPaxId);
            if (localPlano) {
              const { coberturas, faixas, itens, ...cleanPlano } = localPlano;
              await upsertOuFalhar('planos_pax', {
                id: planoPaxId,
                tenant_id: tenantId,
                empresa_id: empresaId,
                nome: cleanPlano.nome || associadoToSave.plano_nome || 'Plano PAX',
                codigo: cleanPlano.codigo || `PLN-${planoPaxId.substring(0, 6).toUpperCase()}`,
                tipo_plano: cleanPlano.tipo_plano || 'individual',
                valor_mensalidade: Number(cleanPlano.valor_mensalidade) || Number(valorPlano) || 0,
                ativo: true,
                ...cleanPlano
              }, 'id');
            }
          }
        } catch (planCheckErr) {
          // Pré-sincronização best-effort, e por isso o único `warn` que sobrou aqui: se o
          // plano local não subir, o insert do associado logo abaixo falha na FK e é ESSE
          // erro que chega ao operador, dizendo que o plano não existe. Antes o upsert
          // "resiliente" anulava o `plano_pax_id` nesse ponto e gravava o associado sem
          // plano, em silêncio.
          console.warn('Pré-sincronização do plano_pax falhou; a FK do associado dirá o que falta:', planCheckErr);
        }
      }

      // 3. Prepara os dados sanitizados para o Supabase (sem campos inexistentes como 'municipio')
      const associadoDataSupabase: Record<string, any> = {
        id: associadoId,
        tenant_id: tenantId,
        empresa_id: empresaId,
        nome: rest.nome || '',
        cpf: rest.cpf ? String(rest.cpf).trim() : null,
        rg: rest.rg ? String(rest.rg).trim() : null,
        data_nascimento: dataNascimento,
        sexo: rest.sexo || null,
        nome_pai: rest.nome_pai || null,
        nome_mae: rest.nome_mae || null,
        telefone: rest.telefone || null,
        celular_whatsapp: rest.celular_whatsapp || rest.telefone || null,
        email: rest.email ? String(rest.email).trim() : null,
        endereco_logradouro: rest.endereco_logradouro || rest.logradouro || null,
        endereco_numero: rest.endereco_numero || rest.numero || null,
        endereco_bairro: rest.endereco_bairro || rest.bairro || null,
        endereco_cidade: rest.endereco_cidade || rest.cidade || rest.municipio || null,
        endereco_cep: rest.endereco_cep || rest.cep || null,
        endereco_estado: rest.endereco_estado || rest.uf || null,
        tipo_pessoa: rest.tipo_pessoa || 'PF',
        // `null` quando não é PJ ou quando o id não é um uuid — ver utils/empresaVinculada.ts.
        fornecedor_id: vinculoEmpresaParaGravacao(rest.tipo_pessoa, rest.fornecedor_id),
        tipo_associado: rest.tipo_associado || 'titular',
        plano_pax_id: planoPaxId,
        plano_nome: rest.plano_nome || null,
        numero_contrato: rest.numero_contrato || null,
        n_vidas: nVidas,
        valor_plano: valorPlano,
        data_adesao: dataAdesao,
        assinatura_base64: rest.assinatura_base64 || null,
        documentos: Array.isArray(rest.documentos) ? rest.documentos : [],
        historico_contratos: Array.isArray(rest.historico_contratos) ? rest.historico_contratos : [],
        status: rest.status || 'ativo',
        estado_civil: rest.estado_civil || null,
        profissao: rest.profissao || null,
        observacoes: rest.observacoes || null
      };

      // 4. Salva o Associado. `upsertOuFalhar` lança na recusa — antes o upsert "resiliente"
      // apagava do payload o que o banco reclamasse e devolvia sucesso.
      //
      // O enfileiramento que existia aqui saiu: era recusa indo para a fila de sync, onde
      // repetiria com o mesmo payload e o mesmo resultado, para sempre. Pior, o `catch`
      // externo enfileirava a MESMA recusa de novo — duas tarefas mortas por save.
      await upsertOuFalhar('associados', associadoDataSupabase, 'id');

      // 5. Salva e sincroniza dependentes vinculados de forma seletiva
      // Sem try/catch: dependente que não grava é perda de dado, não detalhe. O operador
      // cadastrou a pessoa, a tela diria "sucesso" e ela não existiria no Postgres. A recusa
      // sobe até o catch externo, que a distingue de queda de rede. O associado já está
      // gravado aqui, e todo upsert é por `id` com `onConflict` — salvar de novo depois de
      // corrigir é idempotente.
      // Busca dependentes atualmente cadastrados no Supabase para este associado
      const { data: existingDeps } = await supabase
        .from('dependentes')
        .select('id')
        .eq('associado_id', associadoId);

      const currentDepIds = new Set(
        (Array.isArray(dependentes) ? dependentes : [])
          .map((d: any) => d.id)
          .filter(Boolean)
      );

      // Exclui apenas os dependentes que foram expressamente removidos do associado
      if (existingDeps && existingDeps.length > 0) {
        const idsToDelete = existingDeps
          .map((d: any) => d.id)
          .filter((id: string) => !currentDepIds.has(id));

        if (idsToDelete.length > 0) {
          const { error: delErr } = await supabase
            .from('dependentes')
            .delete()
            .eq('associado_id', associadoId)
            .in('id', idsToDelete);

          if (delErr) {
            console.warn('Aviso ao excluir dependentes removidos no Supabase:', delErr);
          }
        }
      }

      // Salva/atualiza cada um dos dependentes ativos
      if (Array.isArray(dependentes) && dependentes.length > 0) {
        for (const d of dependentes) {
          const depId = UUID_REGEX.test(d.id || '') ? d.id : crypto.randomUUID();
          const depNasc = (d.data_nascimento && String(d.data_nascimento).trim() !== '') 
            ? String(d.data_nascimento).split('T')[0] 
            : null;
          const depPayload = {
            id: depId,
            associado_id: associadoId,
            tenant_id: tenantId,
            empresa_id: empresaId,
            nome: (d.nome || '').trim().toUpperCase(),
            cpf: d.cpf && String(d.cpf).trim() !== '' ? String(d.cpf).trim() : null,
            data_nascimento: depNasc,
            parentesco: d.parentesco && String(d.parentesco).trim() !== '' ? String(d.parentesco).trim().toUpperCase() : 'OUTRO',
            // Sem isto a inativação de um dependente não chegava ao banco.
            status: d.status === 'inativo' ? 'inativo' : 'ativo'
          };
          await upsertOuFalhar('dependentes', depPayload, 'id');
        }
      }

      // 6. Salva registro na tabela 'contratos' do Supabase se o associado tiver plano
      if (planoPaxId || associadoToSave.plano_pax_id || associadoToSave.plano_nome) {
        // Sem try/catch, pelo mesmo motivo: contrato que não grava deixa o associado com plano
        // na tela e sem contrato no banco — e é o contrato que a geração de mensalidades e os
        // relatórios leem.
        const contratoData: Record<string, any> = {
          tenant_id: tenantId,
          empresa_id: empresaId,
          associado_id: associadoId,
          plano_pax_id: planoPaxId,
          numero_contrato: associadoToSave.numero_contrato || `CTR-${associadoId.substring(0, 8).toUpperCase()}`,
          data_inicio: dataAdesao,
          data_adesao: dataAdesao,
          valor_mensalidade: Number(valorPlano) || 0,
          // O status do CONTRATO, traduzido do status do associado — não copiado dele. Os dois
          // domínios divergem: `associados.status` aceita 'inadimplente' e
          // `contratos_status_check` recusa, com 23514. Ver utils/statusContrato.ts.
          status: statusDoContratoParaAssociado(associadoToSave.status),
          observacoes: (associadoToSave as any).observacoes || null
        };

        // Busca o contrato VIGENTE, não "o contrato" — desde a reativação um associado
        // pode ter vários: o novo ativo e os anteriores inativos. Sem o filtro por status
        // e o `limit(1)`, a consulta devolve mais de uma linha, `maybeSingle` não entrega
        // objeto nenhum e — como o `error` é descartado aqui — o código cairia no ramo de
        // "não existe", **inserindo uma linha nova a cada save** do mesmo associado.
        const { data: contratosVigentes, error: erroContratoExistente } = await supabase
          .from('contratos')
          .select('id')
          .eq('associado_id', associadoId)
          .eq('status', 'ativo')
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(1);
        if (erroContratoExistente) throw erroContratoExistente;

        contratoData.id = contratosVigentes?.[0]?.id || crypto.randomUUID();

        await upsertOuFalhar('contratos', contratoData, 'id');
      }
    } catch (err: any) {
      // Recusa do servidor NÃO vai para a fila: o payload continuaria igual e o Postgres
      // continuaria recusando. O formulário fica aberto com tudo preenchido e o operador
      // corrige — que é a regra que o CLAUDE.md fixa desde `saveAtendimento`.
      if (err instanceof RecusaDoServidor) {
        console.error('Supabase recusou a gravação do associado:', err.message);
        throw err;
      }
      // Exceção lançada (rede fora, fetch abortado) é o caso offline-first legítimo.
      console.error('Supabase save falhou por rede, fallback para fila de sync:', err);
      await addToSyncQueue({
        storeName: STORE_NAME,
        action: 'update',
        data: associadoToSave
      });
      throw err;
    }
  } else {
    await addToSyncQueue({
      storeName: STORE_NAME,
      action: 'update',
      data: associadoToSave
    });
  }
  
  const acao = existing ? 'Editar Associado' : 'Criar Associado';
  try {
    await registrarAuditoria(acao, { 
      id: associadoToSave.id, 
      nome: associadoToSave.nome,
      dados_anteriores: existing,
      dados_novos: associadoToSave
    });
  } catch (e) {
    // ignore audit errors
  }
};

/**
 * Levanta o histórico que impede excluir este associado.
 *
 * Duas fontes, e as duas foram escolhidas pelo que a exclusão destrói:
 *
 * - **Parcelas recebidas** — `softDeleteAssociado` apaga as receitas do associado *e* as
 *   parcelas delas, inclusive as liquidadas. É dinheiro que entrou no caixa e virou
 *   realizado no Plano de Contas.
 * - **Atendimentos** — do titular **e dos dependentes**. O atendimento é o velório que a
 *   família já usou; ele some com a cascata e leva os itens junto.
 *
 * Segue o padrão offline-first: online consulta o Postgres, e em qualquer falha (ou
 * offline) cai para o IndexedDB. **A falha não vira "não há histórico"** — cair para o
 * cache é o que impede a rede instável de liberar uma exclusão que o banco recusaria.
 */
export const getHistoricoImpeditivoAssociado = async (
  associado: Pick<Associado, 'id' | 'dependentes'>,
  isOnline: boolean,
): Promise<HistoricoImpeditivo> => {
  const idsDependentes = (associado.dependentes || []).map((d) => d.id).filter(Boolean);
  const parcelasRecebidas: { titulo: string; detalhe?: string }[] = [];
  const atendimentos: { titulo: string; detalhe?: string }[] = [];

  const dataBR = (valor?: string | null) => {
    const texto = (valor || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return '';
    const [ano, mes, dia] = texto.split('-');
    return `${dia}/${mes}/${ano}`;
  };
  const moeda = (valor?: number | null) =>
    typeof valor === 'number'
      ? valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      : '';

  const descreverParcela = (p: any) => {
    const numero = p.numero_parcela ? `Parcela ${p.numero_parcela}` : 'Parcela';
    const detalhes = [
      p.data_pagamento ? `Recebida em ${dataBR(p.data_pagamento)}` : 'Recebida',
      moeda(p.valor_recebido ?? p.valor),
    ].filter(Boolean);
    return { titulo: `${numero} — ${p.descricao || 'Mensalidade'}`, detalhe: detalhes.join(' · ') };
  };

  const descreverAtendimento = (a: any) => ({
    titulo: a.falecido_nome || 'Atendimento',
    detalhe: [a.data_obito ? `Óbito em ${dataBR(a.data_obito)}` : '', a.status ? a.status.toUpperCase() : '']
      .filter(Boolean)
      .join(' · '),
  });

  let remotoOk = false;

  if (isOnline) {
    try {
      const { data: receitas } = await supabase
        .from('receitas')
        .select('id')
        .eq('associado_id', associado.id);

      const receitaIds = (receitas || []).map((r: any) => r.id);
      if (receitaIds.length > 0) {
        const { data: parcelas } = await supabase
          .from('parcelas_receber')
          .select('numero_parcela, descricao, valor, valor_recebido, data_pagamento, status')
          .in('receita_id', receitaIds)
          .in('status', ['recebido', 'pago']);
        for (const p of parcelas || []) parcelasRecebidas.push(descreverParcela(p));
      }

      // Atendimentos do titular e dos dependentes: `dependente_id` é quem liga o
      // atendimento ao dependente, e um velório de dependente impede igual.
      const filtros = [`associado_id.eq.${associado.id}`];
      if (idsDependentes.length > 0) filtros.push(`dependente_id.in.(${idsDependentes.join(',')})`);
      const { data: atends } = await supabase
        .from('atendimentos')
        .select('falecido_nome, data_obito, status')
        .or(filtros.join(','));
      for (const a of atends || []) atendimentos.push(descreverAtendimento(a));

      remotoOk = true;
    } catch (e) {
      console.warn('Falha ao levantar histórico do associado no Supabase, caindo para o cache:', e);
    }
  }

  if (!remotoOk) {
    try {
      const receitasLocais = await getAllFromIDB<any>('receitas');
      const idsReceita = new Set(
        receitasLocais.filter((r) => r && r.associado_id === associado.id).map((r) => r.id),
      );
      const parcelasLocais = await getAllFromIDB<any>('parcelas_receber');
      for (const p of parcelasLocais) {
        if (p && idsReceita.has(p.receita_id) && (p.status === 'recebido' || p.status === 'pago')) {
          parcelasRecebidas.push(descreverParcela(p));
        }
      }

      const atendsLocais = await getAllFromIDB<any>('atendimentos');
      const setDeps = new Set(idsDependentes);
      for (const a of atendsLocais) {
        if (a && (a.associado_id === associado.id || (a.dependente_id && setDeps.has(a.dependente_id)))) {
          atendimentos.push(descreverAtendimento(a));
        }
      }
    } catch (e) {
      console.warn('Falha ao levantar histórico do associado no cache local:', e);
    }
  }

  return montarHistoricoImpeditivo({ parcelasRecebidas, atendimentos });
};

export interface ResultadoInativacao {
  dependentesInativados: number;
  contratosInativados: number;
  parcelasCanceladas: number;
}

/**
 * Inativa o associado e tudo que o mantinha circulando.
 *
 * É a saída oferecida quando a exclusão é recusada, e a diferença entre as duas é o ponto:
 * **excluir apaga o histórico; inativar preserva o histórico e tira o cadastro de
 * circulação.** Depois disto o associado e seus dependentes somem dos seletores de
 * atendimento, requisição e contrato, mas as parcelas recebidas, os atendimentos e as
 * guias continuam lá, inteiros, para relatório e conferência.
 *
 * Três efeitos, e o terceiro é decisão de negócio, não consequência técnica:
 *
 * - **Dependentes vão junto.** Um dependente ativo de um titular inativo seria selecionável
 *   num atendimento novo — a cobertura dele vem do plano do titular, que acabou de parar.
 * - **Contrato vai para `inativo`**, então não gera mensalidade nova.
 * - **Parcelas em aberto são canceladas** (`pendente`/`vencido`/`atrasado` ⇒ `cancelado`).
 *   A dívida é perdoada: a inativação aqui é tipicamente por falecimento, e seguir cobrando
 *   mensalidade de quem morreu é o comportamento que esta função existe para evitar.
 *   Parcela **recebida não é tocada** — ver `cancelarParcelasEmAbertoDoAssociado`.
 *
 * Reativar é trabalho manual e deliberado: nada aqui é desfeito automaticamente, porque
 * ressuscitar parcelas canceladas sem alguém olhar recriaria cobrança que já foi baixada.
 */
export const inativarAssociadoEmCascata = async (
  associado: Associado,
  isOnline: boolean,
  motivo?: string,
): Promise<ResultadoInativacao> => {
  const dependentes = Array.isArray(associado.dependentes) ? associado.dependentes : [];
  const dependentesInativados = dependentes.filter((d) => d.status !== 'inativo').length;

  const inativado: Associado = {
    ...associado,
    status: 'inativo',
    dependentes: dependentes.map((d) => ({ ...d, status: 'inativo' as const })),
  };
  await saveAssociado(inativado, isOnline);

  let contratosInativados = 0;
  if (isOnline) {
    try {
      const { data, error } = await supabase
        .from('contratos')
        .update({ status: 'inativo' })
        .eq('associado_id', associado.id)
        .eq('status', 'ativo')
        .select('id');
      if (error) console.warn('Erro ao inativar contratos do associado:', error);
      contratosInativados = (data || []).length;
    } catch (e) {
      console.warn('Falha ao inativar contratos no Supabase:', e);
    }
  }

  try {
    const contratosLocais = await getAllFromIDB<any>('contratos');
    for (const contrato of contratosLocais) {
      if (!contrato || contrato.associado_id !== associado.id || contrato.status !== 'ativo') continue;
      const atualizado = { ...contrato, status: 'inativo' };
      await saveToIDB('contratos', atualizado);
      if (!isOnline) {
        await addToSyncQueue({ storeName: 'contratos', action: 'update', data: atualizado });
        contratosInativados += 1;
      }
    }
  } catch (e) {
    console.warn('Falha ao inativar contratos no cache local:', e);
  }

  const parcelasCanceladas = await cancelarParcelasEmAbertoDoAssociado(associado.id, isOnline);

  try {
    await registrarAuditoria('Inativar Associado e Vínculos', {
      associado_id: associado.id,
      associado_nome: associado.nome,
      status_anterior: associado.status,
      motivo: motivo || 'Inativação solicitada na tela de Associados',
      dependentes_inativados: dependentesInativados,
      contratos_inativados: contratosInativados,
      parcelas_canceladas: parcelasCanceladas,
    });
  } catch (e) {
    console.warn('Falha ao registrar auditoria da inativação:', e);
  }

  return { dependentesInativados, contratosInativados, parcelasCanceladas };
};

export const softDeleteAssociado = async (id: string, isOnline: boolean): Promise<void> => {
  // 0. Recusa antes de qualquer apagamento.
  //
  // O nome mente: esta função é uma cascata de hard delete — receitas, parcelas já
  // recebidas, atendimentos, requisições, contratos e dependentes saem do IndexedDB E do
  // Postgres. Só a tela bloqueando não bastaria: a guarda tem de viver aqui, antes da
  // primeira linha ser tocada, porque a partir da limpeza local não há como voltar atrás.
  const associadoAtual =
    (await getFromIDB<Associado>(STORE_NAME, id)) || ({ id, dependentes: [] } as any as Associado);
  const historico = await getHistoricoImpeditivoAssociado(associadoAtual, isOnline);
  if (historico.impede) {
    throw new Error(MENSAGEM_EXCLUSAO_BLOQUEADA);
  }

  // 1. Limpeza no IndexedDB de todas as tabelas vinculadas
  try {
    await deleteFromIDB(STORE_NAME, id);

    // Dependentes locais
    const localDeps = await getAllFromIDB<any>('dependentes');
    for (const d of localDeps) {
      if (d.associado_id === id) {
        await deleteFromIDB('dependentes', d.id);
      }
    }

    // Contratos locais
    const localContratos = await getAllFromIDB<any>('contratos');
    for (const c of localContratos) {
      if (c.associado_id === id) {
        await deleteFromIDB('contratos', c.id);
      }
    }

    // Requisições e Itens locais
    const localReqs = await getAllFromIDB<any>('requisicoes');
    for (const r of localReqs) {
      if (r.associado_id === id) {
        await deleteFromIDB('requisicoes', r.id);
        const localReqItens = await getAllFromIDB<any>('requisicao_itens');
        for (const ri of localReqItens) {
          if (ri.requisicao_id === r.id) {
            await deleteFromIDB('requisicao_itens', ri.id);
          }
        }
      }
    }

    // Atendimentos e Itens locais
    const localAtends = await getAllFromIDB<any>('atendimentos');
    for (const a of localAtends) {
      if (a.associado_id === id) {
        await deleteFromIDB('atendimentos', a.id);
        const localAtendItens = await getAllFromIDB<any>('atendimento_itens');
        for (const ai of localAtendItens) {
          if (ai.atendimento_id === a.id) {
            await deleteFromIDB('atendimento_itens', ai.id);
          }
        }
      }
    }

    // Receitas e Parcelas locais
    const localReceitas = await getAllFromIDB<any>('receitas');
    for (const rec of localReceitas) {
      if (rec.associado_id === id || rec.cliente_id === id) {
        await deleteFromIDB('receitas', rec.id);
        const localParcelas = await getAllFromIDB<any>('parcelas_receber');
        for (const p of localParcelas) {
          if (p.receita_id === rec.id) {
            await deleteFromIDB('parcelas_receber', p.id);
          }
        }
      }
    }
  } catch (e) {
    console.warn('Erro ao limpar registros vinculados no IndexedDB:', e);
  }

  // 2. Exclusão em cascata no Supabase
  if (isOnline) {
    try {
      // a) Parcelas a Receber e Receitas vinculadas ao associado
      const { data: receitas } = await supabase
        .from('receitas')
        .select('id')
        .eq('associado_id', id);

      if (receitas && receitas.length > 0) {
        const receitaIds = receitas.map(r => r.id);
        await supabase.from('parcelas_receber').delete().in('receita_id', receitaIds);
        await supabase.from('receitas').delete().eq('associado_id', id);
      }

      // b) Atendimento Itens e Atendimentos vinculados
      const { data: atendimentos } = await supabase
        .from('atendimentos')
        .select('id')
        .eq('associado_id', id);

      if (atendimentos && atendimentos.length > 0) {
        const atendimentoIds = atendimentos.map(a => a.id);
        await supabase.from('atendimento_itens').delete().in('atendimento_id', atendimentoIds);
        await supabase.from('atendimentos').delete().eq('associado_id', id);
      }

      // c) Requisição Itens e Requisições vinculadas
      const { data: requisicoes } = await supabase
        .from('requisicoes')
        .select('id')
        .eq('associado_id', id);

      if (requisicoes && requisicoes.length > 0) {
        const requisicaoIds = requisicoes.map(r => r.id);
        await supabase.from('requisicao_itens').delete().in('requisicao_id', requisicaoIds);
        await supabase.from('requisicoes').delete().eq('associado_id', id);
      }

      // d) Dependentes vinculados
      await supabase.from('dependentes').delete().eq('associado_id', id);

      // e) Contratos vinculados
      await supabase.from('contratos').delete().eq('associado_id', id);

      // f) Exclusão do Associado da tabela principal
      const { error: deleteErr } = await supabase
        .from('associados')
        .delete()
        .eq('id', id);

      if (deleteErr) {
        // Se hard delete falhar por qualquer motivo, tenta soft delete
        console.warn('Hard delete falhou, aplicando soft-delete:', deleteErr.message);
        const { error: softErr } = await supabase
          .from('associados')
          .update({ deleted_at: new Date().toISOString(), status: 'inativo' })
          .eq('id', id);

        if (softErr) {
          throw new Error(softErr.message || deleteErr.message);
        }
      }
    } catch (err: any) {
      console.warn('Erro na exclusão online no Supabase, enfileirando para sincronização:', err?.message || err);
      await addToSyncQueue({
        storeName: STORE_NAME,
        action: 'delete',
        data: { id }
      });
    }
  } else {
    // Se offline, adiciona à fila de sincronização
    await addToSyncQueue({
      storeName: STORE_NAME,
      action: 'delete',
      data: { id }
    });
  }

  try {
    await registrarAuditoria('Excluir Associado e Vínculos', { id });
  } catch (e) {}
};

export const deleteAssociado = softDeleteAssociado;

export const deleteDependente = async (
  depId: string,
  associadoId: string,
  isOnline: boolean
): Promise<void> => {
  try {
    await deleteFromIDB('dependentes', depId);
    const assoc = await getFromIDB<Associado>(STORE_NAME, associadoId);
    if (assoc && assoc.dependentes) {
      assoc.dependentes = assoc.dependentes.filter(d => d.id !== depId);
      assoc.n_vidas = 1 + assoc.dependentes.length;
      await saveToIDB(STORE_NAME, assoc);
    }
    if (isOnline) {
      await supabase.from('dependentes').delete().eq('id', depId);
    } else {
      await addToSyncQueue({
        storeName: 'dependentes',
        action: 'delete',
        data: { id: depId, associado_id: associadoId }
      });
    }
  } catch (err) {
    console.error('Erro ao excluir dependente:', err);
    throw err;
  }
};

export interface DocumentoAssociado {
  id: string;
  nome: string;
  url: string;
  tipo: string;
  tamanho: number;
  data_upload: string;
}

export const uploadDocumentoAssociado = async (
  file: File,
  associadoId?: string,
  isOnline: boolean = true
): Promise<DocumentoAssociado> => {
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('O arquivo excede o limite máximo permitido de 10MB.');
  }

  let finalUrl = '';

  if (isOnline) {
    try {
      const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `associados/${associadoId || 'geral'}/${Date.now()}_${cleanName}`;

      const { data, error } = await supabase.storage
        .from('arquivos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (!error && data) {
        const { data: publicData } = supabase.storage
          .from('arquivos')
          .getPublicUrl(data.path);
        
        if (publicData?.publicUrl) {
          finalUrl = publicData.publicUrl;
        }
      }
    } catch (storageErr) {
      console.warn('Upload Supabase Storage falhou, usando fallback Base64:', storageErr);
    }
  }

  if (!finalUrl) {
    finalUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Falha ao processar arquivo'));
        }
      };
      reader.onerror = () => reject(new Error('Erro ao ler arquivo local'));
      reader.readAsDataURL(file);
    });
  }

  const docId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  return {
    id: docId,
    nome: file.name,
    url: finalUrl,
    tipo: file.type || 'application/octet-stream',
    tamanho: file.size,
    data_upload: new Date().toISOString()
  };
};
