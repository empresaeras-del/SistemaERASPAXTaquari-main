/**
 * Estado das categorias de fornecedor da empresa selecionada.
 *
 * Mesmo desenho de `useCentrosCusto`: o hook só orquestra (carregar, salvar, recarregar) e
 * toda a regra — código derivado do nome, ordenação, o que o seletor oferece — mora em
 * `utils/categoriasFornecedor.ts`, que é puro e testado.
 */
import { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import { CategoriaFornecedorRegistro } from '../types/categoriaFornecedor';
import {
  getCategoriasFornecedor,
  salvarCategoriaFornecedor as salvarService,
  desativarCategoriaFornecedor as desativarService,
  reativarCategoriaFornecedor as reativarService,
} from '../services/categoriasFornecedorService';
import { tenantDeEscrita } from '../utils/tenant';

export function useCategoriasFornecedor() {
  const { state } = useAppContext();
  const { isOnline, empresaSelecionada } = state;

  // Resolução canônica (utils/tenant.ts). `null` é "super_admin sem empresa escolhida": o
  // service recusa a gravação com MENSAGEM_TENANT_INDEFINIDO em vez de carimbar um coringa.
  const tenantDestino = tenantDeEscrita(empresaSelecionada, state.user?.tenant_id);

  const [categorias, setCategorias] = useState<CategoriaFornecedorRegistro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCategorias(await getCategoriasFornecedor(isOnline, empresaSelecionada));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar as categorias de fornecedor.');
      setCategorias([]);
    } finally {
      setLoading(false);
    }
  }, [isOnline, empresaSelecionada]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const salvar = useCallback(
    async (dados: Partial<CategoriaFornecedorRegistro>) => {
      const salvo = await salvarService(
        isOnline,
        { ...dados, tenant_id: dados.tenant_id || tenantDestino || undefined },
        categorias,
      );
      await carregar();
      return salvo;
    },
    [isOnline, tenantDestino, categorias, carregar],
  );

  const desativar = useCallback(
    async (categoria: CategoriaFornecedorRegistro) => {
      await desativarService(isOnline, categoria);
      await carregar();
    },
    [isOnline, carregar],
  );

  const reativar = useCallback(
    async (categoria: CategoriaFornecedorRegistro) => {
      await reativarService(isOnline, categoria);
      await carregar();
    },
    [isOnline, carregar],
  );

  return { categorias, loading, error, carregar, salvar, desativar, reativar };
}
