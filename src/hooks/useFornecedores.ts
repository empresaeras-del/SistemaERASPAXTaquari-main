import { useState, useEffect } from 'react';
import { generateUUID } from '../utils/uuid';
import { supabase } from '../lib/supabase';
import { 
  Fornecedor, 
  FornecedorInsert, 
  FornecedorUpdate, 
  FornecedorFiltros,
  StatusFornecedor 
} from '../types/fornecedores';
import { getFromIDB, saveToIDB, getAllFromIDB, deleteFromIDB } from '../lib/idb';
import { useAppContext } from '../context/AppContext';

// Sample mock data for initial seed when empty
const SEED_FORNECEDORES: Fornecedor[] = [
  {
    id: 'forn-001',
    codigo: 'FORN0001',
    razao_social: 'Indústria e Comércio de Urnas Pax Brasil Ltda',
    nome_fantasia: 'Urnas Pax Brasil',
    cnpj_cpf: '12.345.678/0001-90',
    tipo_pessoa: 'PJ',
    inscricao_estadual: '123456789',
    inscricao_municipal: '987654',
    tipo_fornecedor: 'produtos',
    categoria: 'Urnas e Caixões',
    status: 'ativo',
    contato_nome: 'Carlos Eduardo Oliveira',
    telefone: '(11) 3456-7890',
    celular_whatsapp: '(11) 98765-4321',
    email: 'vendas@urnaspaxbrasil.com.br',
    website: 'https://www.urnaspaxbrasil.com.br',
    cep: '01001-000',
    logradouro: 'Praça da Sé',
    numero: '100',
    complemento: 'Galpão A',
    bairro: 'Sé',
    cidade: 'São Paulo',
    uf: 'SP',
    dados_bancarios: {
      banco: '341 - Itaú Unibanco',
      agencia: '1234',
      conta: '56789-0',
      tipo_conta: 'corrente',
      chave_pix: '12.345.678/0001-90'
    },
    observacoes: 'Fornecedor principal de urnas padrão e luxo. Entrega quinzenal.',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'forn-002',
    codigo: 'FORN0002',
    razao_social: 'Floricultura e Coroas Jardim das Flores Eireli',
    nome_fantasia: 'Jardim das Flores',
    cnpj_cpf: '98.765.432/0001-10',
    tipo_pessoa: 'PJ',
    inscricao_estadual: '987654321',
    tipo_fornecedor: 'produtos',
    categoria: 'Floricultura e Coroas',
    status: 'ativo',
    contato_nome: 'Maria Aparecida Santos',
    telefone: '(11) 2233-4455',
    celular_whatsapp: '(11) 97123-4567',
    email: 'contato@jardimdasflores.com.br',
    cep: '04001-001',
    logradouro: 'Rua Vergueiro',
    numero: '1500',
    bairro: 'Vila Mariana',
    cidade: 'São Paulo',
    uf: 'SP',
    dados_bancarios: {
      banco: '237 - Bradesco',
      agencia: '0432',
      conta: '12876-5',
      tipo_conta: 'corrente',
      chave_pix: 'contato@jardimdasflores.com.br'
    },
    observacoes: 'Atendimento 24h para confecção de coroas e ornamentação.',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'forn-003',
    codigo: 'FORN0003',
    razao_social: 'Translado Express Serviços de Frota Ltda',
    nome_fantasia: 'Translado Express',
    cnpj_cpf: '45.678.901/0001-23',
    tipo_pessoa: 'PJ',
    tipo_fornecedor: 'servicos',
    categoria: 'Translado e Veículos',
    status: 'ativo',
    contato_nome: 'Roberto Alves',
    telefone: '(11) 3344-5566',
    celular_whatsapp: '(11) 98877-6655',
    email: 'operacional@transladoexpress.com.br',
    cep: '03001-000',
    logradouro: 'Avenida Celso Garcia',
    numero: '800',
    bairro: 'Brás',
    cidade: 'São Paulo',
    uf: 'SP',
    dados_bancarios: {
      banco: '001 - Banco do Brasil',
      agencia: '3210',
      conta: '9876-5',
      tipo_conta: 'corrente',
      chave_pix: '45678901000123'
    },
    observacoes: 'Prestador credenciado para transporte rodoviário interestadual com veiculos adaptados.',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'forn-004',
    codigo: 'FORN0004',
    razao_social: 'Marmoraria e Arte Sacra São José Eireli',
    nome_fantasia: 'Marmoraria São José',
    cnpj_cpf: '78.901.234/0001-56',
    tipo_pessoa: 'PJ',
    tipo_fornecedor: 'ambos',
    categoria: 'Marmoraria e Lápides',
    status: 'ativo',
    contato_nome: 'Antônio Ferreira',
    telefone: '(11) 4002-8922',
    celular_whatsapp: '(11) 99112-2334',
    email: 'vendas@marmorariasaojose.com.br',
    cep: '08000-000',
    logradouro: 'Avenida Marechal Tito',
    numero: '2500',
    bairro: 'São Miguel Paulista',
    cidade: 'São Paulo',
    uf: 'SP',
    dados_bancarios: {
      banco: '104 - Caixa Econômica Federal',
      agencia: '0234',
      conta: '0001234-5',
      tipo_conta: 'corrente',
      chave_pix: 'vendas@marmorariasaojose.com.br'
    },
    observacoes: 'Fornece placas de granito, gravações personalizadas e serviços de assentamento.',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

export function useFornecedores() {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState<FornecedorFiltros>({});
  const { state: { user, isOnline, empresaSelecionada } } = useAppContext();

  const carregarFornecedores = async () => {
    setLoading(true);
    try {
      if (isOnline) {
        try {
          let query = supabase.from('fornecedores').select('*').is('deleted_at', null);
          if (empresaSelecionada && empresaSelecionada !== 'all') {
            query = query.or(`empresa_id.eq.${empresaSelecionada},tenant_id.eq.${empresaSelecionada}`);
          }
          const { data, error } = await query.order('created_at', { ascending: false });
          if (!error && data && data.length > 0) {
            for (const item of data) {
              await saveToIDB('fornecedores', item);
            }
          }
        } catch (e) {
          console.warn('Erro ao carregar do Supabase:', e);
        }
      }

      let all = await getAllFromIDB<Fornecedor>('fornecedores');
      if (empresaSelecionada && empresaSelecionada !== 'all') {
        all = all.filter(f => (f as any).empresa_id === empresaSelecionada || (f as any).tenant_id === empresaSelecionada);
      }
      all = all.filter(f => !(f as any).deleted_at);

      if (all.length === 0) {
        setFornecedores([]);
        return;
      }

      let filtrados = [...all];

      if (filtros.busca) {
        const term = filtros.busca.toLowerCase();
        filtrados = filtrados.filter(f => 
          f.razao_social.toLowerCase().includes(term) ||
          f.nome_fantasia.toLowerCase().includes(term) ||
          f.codigo.toLowerCase().includes(term) ||
          f.cnpj_cpf.toLowerCase().includes(term) ||
          (f.contato_nome && f.contato_nome.toLowerCase().includes(term)) ||
          (f.cidade && f.cidade.toLowerCase().includes(term))
        );
      }

      if (filtros.categoria && filtros.categoria !== 'todas') {
        filtrados = filtrados.filter(f => f.categoria === filtros.categoria);
      }

      if (filtros.tipo_fornecedor && filtros.tipo_fornecedor !== 'todos') {
        filtrados = filtrados.filter(f => f.tipo_fornecedor === filtros.tipo_fornecedor);
      }

      if (filtros.status && filtros.status !== 'todos') {
        filtrados = filtrados.filter(f => f.status === filtros.status);
      }

      setFornecedores(filtrados);
    } catch (err) {
      console.error('Erro ao carregar fornecedores:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarFornecedores();
  }, [filtros, isOnline, empresaSelecionada]);

  const criar = async (data: FornecedorInsert) => {
    try {
      const now = new Date().toISOString();
      const tenantId = (data as any).empresa_id || (empresaSelecionada && empresaSelecionada !== 'all' ? empresaSelecionada : 'emp-001');
      const newFornecedor: Fornecedor = {
        ...data,
        id: generateUUID(),
        created_at: now,
        updated_at: now,
        created_by: user?.id,
        empresa_id: tenantId,
        tenant_id: tenantId
      };

      if (isOnline) {
        const { data: inserted, error } = await supabase
          .from('fornecedores')
          .insert([newFornecedor])
          .select()
          .single();

        if (error) {
          console.error('Erro Supabase ao criar fornecedor:', error);
          throw new Error(`Erro ao salvar fornecedor no banco: ${error.message}`);
        }
        if (inserted) {
          await saveToIDB('fornecedores', inserted);
          await carregarFornecedores();
          return inserted as Fornecedor;
        }
      }

      await saveToIDB('fornecedores', newFornecedor);
      await carregarFornecedores();
      return newFornecedor;
    } catch (err: any) {
      if (err instanceof Error) throw err;
      throw new Error(err.message || 'Erro ao cadastrar fornecedor.');
    }
  };

  const editar = async (id: string, data: FornecedorUpdate) => {
    try {
      const now = new Date().toISOString();
      const existing = await getFromIDB<Fornecedor>('fornecedores', id);
      const tenantId = (data as any).empresa_id || (existing as any)?.empresa_id || (empresaSelecionada && empresaSelecionada !== 'all' ? empresaSelecionada : 'emp-001');

      const updatedFornecedor: Fornecedor = {
        ...(existing || {} as Fornecedor),
        ...data,
        id,
        empresa_id: tenantId,
        tenant_id: tenantId,
        updated_at: now
      };

      if (isOnline) {
        const { data: updated, error } = await supabase
          .from('fornecedores')
          .update({ ...data, empresa_id: tenantId, tenant_id: tenantId, updated_at: now })
          .eq('id', id)
          .select()
          .single();

        if (error) {
          console.error('Erro Supabase ao editar fornecedor:', error);
          throw new Error(`Erro ao atualizar fornecedor no banco: ${error.message}`);
        }
        if (updated) {
          await saveToIDB('fornecedores', updated);
          await carregarFornecedores();
          return updated as Fornecedor;
        }
      }

      await saveToIDB('fornecedores', updatedFornecedor);
      await carregarFornecedores();
      return updatedFornecedor;
    } catch (err: any) {
      if (err instanceof Error) throw err;
      throw new Error(err.message || 'Erro ao atualizar fornecedor.');
    }
  };

  const alterarStatus = async (id: string, novoStatus: StatusFornecedor) => {
    try {
      await editar(id, { status: novoStatus });
    } catch (err: any) {
      throw new Error(err.message || 'Erro ao alterar status do fornecedor.');
    }
  };

  const excluir = async (id: string) => {
    try {
      if (isOnline) {
        try {
          await supabase.from('fornecedores').delete().eq('id', id);
        } catch (e) {
          console.warn('Erro Supabase ao excluir fornecedor:', e);
        }
      }
      await deleteFromIDB('fornecedores', id);
      await carregarFornecedores();
    } catch (err: any) {
      throw new Error(err.message || 'Erro ao excluir fornecedor.');
    }
  };

  const reordenarOuRestaurarSeed = async () => {
    for (const f of SEED_FORNECEDORES) {
      await saveToIDB('fornecedores', f);
    }
    await carregarFornecedores();
  };

  return {
    fornecedores,
    loading,
    filtros,
    setFiltros,
    criar,
    editar,
    alterarStatus,
    excluir,
    recarregar: carregarFornecedores,
    restaurarDadosExemplo: reordenarOuRestaurarSeed
  };
}
