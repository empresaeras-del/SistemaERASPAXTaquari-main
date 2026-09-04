import { supabase, registrarAuditoria } from '../lib/supabase';
import { getFromIDB, saveToIDB, getAllFromIDB, deleteFromIDB } from '../lib/idb';
import { addToSyncQueue } from '../lib/syncService';

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
          query = query.or(`tenant_id.eq.${tenantId},empresa_id.eq.${tenantId},tenant_id.eq.default_tenant,tenant_id.eq.empresa_padrao`);
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
          query = query.or(`tenant_id.eq.${tenantId},empresa_id.eq.${tenantId},tenant_id.eq.default_tenant,tenant_id.eq.empresa_padrao`);
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
        
        // Merge dados do Supabase com os locais (preservando cadastros locais mais recentes)
        const remoteMap = new Map<string, Associado>();
        data.forEach((item: any) => {
          remoteMap.set(item.id, {
            ...item,
            dependentes: Array.isArray(item.dependentes) ? item.dependentes : []
          });
        });

        // Adiciona itens locais que ainda não estão no remoto
        localAssociados.forEach(localItem => {
          if (!remoteMap.has(localItem.id) && !localItem.deleted_at) {
            remoteMap.set(localItem.id, localItem);
          }
        });

        associados = Array.from(remoteMap.values());
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
      const matchTenant = !a.tenant_id || 
        a.tenant_id === tenantId || 
        a.tenant_id === 'all' || 
        a.tenant_id === 'default_tenant' || 
        a.tenant_id === 'empresa_padrao' ||
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

/**
 * Executa um upsert no Supabase de forma resiliente:
 * 1. Se falhar por coluna inexistente no schema cache do PostgREST (PGRST204 ou erro 42703),
 *    detecta dinamicamente a coluna, remove do payload e tenta novamente.
 * 2. Se falhar por foreign key em plano_pax_id (23503), anula o campo e tenta novamente.
 * 3. Se falhar por empresa_id/tenant_id em constraints locais, remove ou ajusta e tenta novamente.
 */
export async function resilientSupabaseUpsert(
  tableName: string,
  data: Record<string, any>,
  onConflict: string = 'id',
  maxRetries: number = 8
): Promise<{ data: any; error: any }> {
  const currentPayload = { ...data };

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const { data: resData, error } = await supabase
      .from(tableName)
      .upsert(currentPayload, { onConflict });

    if (!error) {
      return { data: resData, error: null };
    }

    const errMsg = error.message || '';
    const errDetails = error.details || '';
    const fullErr = `${errMsg} ${errDetails}`;

    // 1. Detecta coluna inexistente no schema cache do PostgREST
    const missingColMatch =
      fullErr.match(/Could not find the '([^']+)' column/i) ||
      fullErr.match(/column "([^"]+)" of relation/i) ||
      fullErr.match(/column "([^"]+)" does not exist/i) ||
      fullErr.match(/column ([a-zA-Z0-9_]+) does not exist/i);

    if (missingColMatch && missingColMatch[1]) {
      const colToRemove = missingColMatch[1];
      console.warn(`[resilientSupabaseUpsert] Tabela ${tableName}: Coluna '${colToRemove}' ausente no Supabase. Removendo do payload e reprocessando...`);
      delete currentPayload[colToRemove];
      continue;
    }

    // 2. Detecta violação de Foreign Key em plano_pax_id
    if (fullErr.includes('plano_pax_id') || fullErr.includes('planos_pax') || error.code === '23503') {
      if (currentPayload.plano_pax_id !== undefined && currentPayload.plano_pax_id !== null) {
        console.warn(`[resilientSupabaseUpsert] Tabela ${tableName}: FK de plano_pax_id violada. Anulando plano_pax_id e reprocessando...`);
        currentPayload.plano_pax_id = null;
        continue;
      }
    }

    // 3. Se falhar por empresa_id
    if (fullErr.includes('empresa_id') && currentPayload.empresa_id) {
      console.warn(`[resilientSupabaseUpsert] Tabela ${tableName}: Erro com empresa_id. Removendo e reprocessando...`);
      delete currentPayload.empresa_id;
      continue;
    }

    // Se for outro erro irrecuperável, retorna
    return { data: null, error };
  }

  return { data: null, error: new Error(`Excedido limite de tentativas de sanitização para ${tableName}`) };
}

export const saveAssociado = async (associado: Associado, isOnline: boolean): Promise<void> => {
  const existing = await getFromIDB<Associado>(STORE_NAME, associado.id);
  
  // Extrai dependentes e campos não existentes na tabela principal do Supabase
  const { dependentes, fornecedor_id, ...rest } = associado as any;

  // Garante que o ID do associado é um UUID válido
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const associadoId = UUID_REGEX.test(associado.id) ? associado.id : crypto.randomUUID();

  const tenantId = (rest.tenant_id && rest.tenant_id !== 'all') 
    ? rest.tenant_id 
    : 'default_tenant';
  const empresaId = (rest.empresa_id && rest.empresa_id !== 'all') 
    ? rest.empresa_id 
    : tenantId;

  const planoPaxId = rest.plano_pax_id && UUID_REGEX.test(rest.plano_pax_id) ? rest.plano_pax_id : null;
  const planoId = rest.plano_id && UUID_REGEX.test(rest.plano_id) ? rest.plano_id : null;

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
              await resilientSupabaseUpsert('planos_pax', {
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
          console.warn('Verificação de plano_pax falhou:', planCheckErr);
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
        logradouro: rest.endereco_logradouro || rest.logradouro || null,
        endereco_numero: rest.endereco_numero || rest.numero || null,
        numero: rest.endereco_numero || rest.numero || null,
        endereco_bairro: rest.endereco_bairro || rest.bairro || null,
        bairro: rest.endereco_bairro || rest.bairro || null,
        endereco_cidade: rest.endereco_cidade || rest.cidade || rest.municipio || null,
        cidade: rest.endereco_cidade || rest.cidade || rest.municipio || null,
        endereco_cep: rest.endereco_cep || rest.cep || null,
        cep: rest.endereco_cep || rest.cep || null,
        endereco_estado: rest.endereco_estado || rest.uf || null,
        uf: rest.endereco_estado || rest.uf || null,
        tipo_pessoa: rest.tipo_pessoa || 'PF',
        tipo_associado: rest.tipo_associado || 'titular',
        plano_id: planoId,
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

      // 4. Salva o Associado no Supabase com resiliência a esquemas divergentes
      const { error: assocError } = await resilientSupabaseUpsert('associados', associadoDataSupabase, 'id');

      if (assocError) {
        console.error('Erro ao salvar associado no Supabase:', assocError);
        await addToSyncQueue({
          storeName: STORE_NAME,
          action: 'update',
          data: associadoToSave
        });
        throw new Error(`Erro ao salvar associado no Supabase: ${assocError.message || assocError}`);
      }

      // 5. Salva e sincroniza dependentes vinculados de forma seletiva
      try {
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
              parentesco: d.parentesco && String(d.parentesco).trim() !== '' ? String(d.parentesco).trim().toUpperCase() : 'OUTRO'
            };
            await resilientSupabaseUpsert('dependentes', depPayload, 'id');
          }
        }
      } catch (depErr) {
        console.warn('Erro ao sincronizar dependentes:', depErr);
      }

      // 6. Salva registro na tabela 'contratos' do Supabase se o associado tiver plano
      if (planoPaxId || associadoToSave.plano_pax_id || associadoToSave.plano_nome) {
        try {
          const contratoData: Record<string, any> = {
            tenant_id: tenantId,
            empresa_id: empresaId,
            associado_id: associadoId,
            plano_pax_id: planoPaxId,
            numero_contrato: associadoToSave.numero_contrato || `CTR-${associadoId.substring(0, 8).toUpperCase()}`,
            data_inicio: dataAdesao,
            data_adesao: dataAdesao,
            valor_mensalidade: Number(valorPlano) || 0,
            status: associadoToSave.status || 'ativo',
            observacoes: (associadoToSave as any).observacoes || null
          };

          const { data: existingContrato } = await supabase
            .from('contratos')
            .select('id')
            .eq('associado_id', associadoId)
            .maybeSingle();

          if (existingContrato?.id) {
            contratoData.id = existingContrato.id;
          } else {
            contratoData.id = crypto.randomUUID();
          }

          await resilientSupabaseUpsert('contratos', contratoData, 'id');
        } catch (contratoErr) {
          console.warn('Erro ao sincronizar contrato no Supabase:', contratoErr);
        }
      }
    } catch (err: any) {
      console.error('Supabase save falhou, fallback para fila de sync:', err);
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

export const softDeleteAssociado = async (id: string, isOnline: boolean): Promise<void> => {
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
