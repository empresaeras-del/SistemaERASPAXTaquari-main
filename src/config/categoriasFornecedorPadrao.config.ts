/**
 * Lista modelo de categorias de fornecedor.
 *
 * Era `defaultCategoriasList`, declarada **duas vezes** — em `FornecedoresPage.tsx` e em
 * `FornecedorFormModal.tsx` — e servia de estado inicial do `localStorage`. Depois que as
 * categorias viraram tabela (migration `20260918010924`), ela tem dois papéis, e só dois:
 *
 * 1. é o que a migration de backfill semeou para cada empresa existente — os nomes aqui e os
 *    de lá são os mesmos de propósito, e há teste travando os 12 códigos derivados;
 * 2. é o **fallback** do seletor para uma empresa que ainda não tem nenhuma categoria
 *    cadastrada (uma empresa criada depois da migration). Sem ele o formulário abriria com um
 *    select vazio e não daria para salvar fornecedor nenhum — é a mesma escolha do seletor de
 *    centro de custo e da isenção "empresa sem conta lançável" da fase 3 do plano contábil:
 *    só se exige o que é possível cumprir.
 *
 * A ordem é a que a tela mostra; `CATEGORIA_EMPRESA_CONVENIADA` vem primeiro porque é a que o
 * vínculo com o associado PJ depende.
 */
import { CATEGORIA_EMPRESA_CONVENIADA } from '../utils/empresaVinculada';

export const CATEGORIAS_FORNECEDOR_PADRAO: readonly string[] = [
  CATEGORIA_EMPRESA_CONVENIADA,
  'Urnas e Caixões',
  'Floricultura e Coroas',
  'Marmoraria e Lápides',
  'Translado e Veículos',
  'Equipamentos Médicos',
  'Tanatopraxia e Insumos',
  'Cemitério e Crematório',
  'Gráfica e Impressões',
  'Manutenção e Conservação',
  'Tecnologia e Sistemas',
  'Outros',
];
