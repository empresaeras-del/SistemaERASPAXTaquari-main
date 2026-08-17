import re

with open('src/pages/FaturamentosPage.tsx', 'r') as f:
    content = f.read()

# 1. Add editingRemessa state
content = content.replace(
    "const [modalNovaRemessa, setModalNovaRemessa] = useState(false);",
    "const [modalNovaRemessa, setModalNovaRemessa] = useState(false);\n  const [editingRemessa, setEditingRemessa] = useState<RemessaFaturamento | null>(null);"
)

# 2. Update resetNovaRemessaForm
content = content.replace(
    "setRequisicoesSelecionadasIds([]);",
    "setRequisicoesSelecionadasIds([]);\n    setEditingRemessa(null);"
)

# 3. Update handleCriarRemessa
handle_criar = """
    try {
      if (editingRemessa) {
        const atualizada: RemessaFaturamento = {
          ...editingRemessa,
          tipo_prestador: tipoPrestador,
          credenciado_id: tipoPrestador === 'credenciado' ? selCredenciadoId : undefined,
          credenciado_nome: credNome,
          credenciado_cnpj_cpf: credCnpj,
          requisicao_ids: requisicoesSelecionadasIds,
          qtd_guias: requisicoesSelecionadasIds.length,
          valor_bruto: valorBrutoNovaRemessa,
          valor_desconto_glosa: Number(valorGlosa) || 0,
          valor_liquido: valorLiquidoNovaRemessa,
          observacoes,
          updated_at: new Date().toISOString()
        };
        await atualizarRemessa(state.isOnline, atualizada);
        toast.success(`Remessa ${atualizada.codigo_remessa} atualizada com sucesso!`);
      } else {
        const nova = await criarRemessa(state.isOnline, tenantId, {
          tenant_id: tenantId,
          tipo_prestador: tipoPrestador,
          credenciado_id: tipoPrestador === 'credenciado' ? selCredenciadoId : undefined,
          credenciado_nome: credNome,
          credenciado_cnpj_cpf: credCnpj,
          requisicao_ids: requisicoesSelecionadasIds,
          qtd_guias: requisicoesSelecionadasIds.length,
          valor_bruto: valorBrutoNovaRemessa,
          valor_desconto_glosa: Number(valorGlosa) || 0,
          valor_liquido: valorLiquidoNovaRemessa,
          status: 'em_aberto',
          observacoes
        });
        toast.success(`Remessa ${nova.codigo_remessa} criada em aberto!`);
      }
      setModalNovaRemessa(false);
      resetNovaRemessaForm();
      await loadData();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar remessa de faturamento.');
    }
"""
regex_handle_criar = re.compile(r"try \{\s*const nova = await criarRemessa.*?toast\.error\('Erro ao criar remessa de faturamento\.'\);\s*\}", re.DOTALL)
content = regex_handle_criar.sub(handle_criar.strip(), content)

# 4. Update the Modal Header for "Nova Remessa"
content = content.replace(
    '<h3 className="font-bold text-lg text-text-base">Nova Remessa de Faturamento</h3>',
    '<h3 className="font-bold text-lg text-text-base">{editingRemessa ? "Editar Remessa de Faturamento" : "Nova Remessa de Faturamento"}</h3>'
)

# 5. Add "Editar" button to modalDetalhes
btn_editar = """
              {modalDetalhes.status === 'em_aberto' && (
                <button
                  onClick={() => {
                    setEditingRemessa(modalDetalhes);
                    setTipoPrestador(modalDetalhes.tipo_prestador);
                    if (modalDetalhes.tipo_prestador === 'credenciado') {
                      setSelCredenciadoId(modalDetalhes.credenciado_id || '');
                    } else {
                      setRedeExternaNome(modalDetalhes.credenciado_nome || '');
                      setRedeExternaCnpj(modalDetalhes.credenciado_cnpj_cpf || '');
                    }
                    setObservacoes(modalDetalhes.observacoes || '');
                    setValorGlosa(modalDetalhes.valor_desconto_glosa || 0);
                    setRequisicoesSelecionadasIds(modalDetalhes.requisicao_ids);
                    setModalDetalhes(null);
                    setModalNovaRemessa(true);
                  }}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-medium flex items-center gap-1.5"
                >
                  <PencilIcon className="w-3.5 h-3.5" />
                  <span>Editar</span>
                </button>
              )}
"""
content = content.replace(
    'className="flex justify-end gap-3 pt-3 border-t border-border-default">',
    'className="flex justify-end gap-3 pt-3 border-t border-border-default">' + btn_editar
)

# 6. Change modalNovaRemessa Cancel behavior to clear editingRemessa
content = content.replace(
    'onClick={() => setModalNovaRemessa(false)}',
    'onClick={() => { setModalNovaRemessa(false); resetNovaRemessaForm(); }}'
)
content = content.replace(
    'onClick={() => setModalNovaRemessa(false)} className="text-text-subtle hover:text-text-base p-1 rounded-lg">',
    'onClick={() => { setModalNovaRemessa(false); resetNovaRemessaForm(); }} className="text-text-subtle hover:text-text-base p-1 rounded-lg">'
)

with open('src/pages/FaturamentosPage.tsx', 'w') as f:
    f.write(content)

