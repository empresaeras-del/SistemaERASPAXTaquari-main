import sys
import re

with open('src/components/credenciados/ProcedimentosCredenciado.tsx', 'r') as f:
    content = f.read()

# Add editValorCoparticipacao state
content = content.replace(
    "const [editValue, setEditValue] = useState<number | ''>('');",
    "const [editValue, setEditValue] = useState<number | ''>('');\n  const [editCoparticipacao, setEditCoparticipacao] = useState<number | ''>('');"
)

# Fix Headers for vincular
content = content.replace(
    """<th className="px-4 py-3 font-semibold text-text-subtle uppercase tracking-wider text-right">Valor Padrão</th>""",
    """<th className="px-4 py-3 font-semibold text-text-subtle uppercase tracking-wider text-right">Valor Padrão</th>
                  <th className="px-4 py-3 font-semibold text-text-subtle uppercase tracking-wider text-right">Co-participação Padrão</th>"""
)

# Fix Rows for vincular
content = content.replace(
    """<td className="px-4 py-3 text-right">
                      {proc.valor_padrao?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>""",
    """<td className="px-4 py-3 text-right">
                      {proc.valor_padrao?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {proc.valor_coparticipacao?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>"""
)

# Fix Header for vinculados
content = content.replace(
    """<th className="px-4 py-3 font-semibold text-text-subtle uppercase tracking-wider text-right">Valor Exclusivo</th>""",
    """<th className="px-4 py-3 font-semibold text-text-subtle uppercase tracking-wider text-right">Valor Exclusivo</th>
                <th className="px-4 py-3 font-semibold text-text-subtle uppercase tracking-wider text-right">Co-part. Exclusiva</th>"""
)

# Fix Row for vinculados
# Find the exact row first
import re
row_pattern = r"""<td className="px-4 py-3 text-right">\s*\{editingId === v\.id \? \(\s*<input\s*type="number"\s*step="0\.01"\s*min="0"\s*value=\{editValue\}\s*onChange=\{\(e\) => setEditValue\(e\.target\.value \? Number\(e\.target\.value\) : ''\)\}\s*className="w-24 bg-bg-surface border border-border-default rounded px-2 py-1 text-text-base text-right text-sm focus:outline-none focus:border-\[\#3B82F6\]"\s*autoFocus\s*/>\s*\) : \(\s*<span className="font-medium text-text-base">\s*\{v\.valor_exclusivo\?\.toLocaleString\('pt-BR', \{ style: 'currency', currency: 'BRL' \}\)\}\s*</span>\s*\)\}\s*</td>"""

replacement_row = """<td className="px-4 py-3 text-right">
                    {editingId === v.id ? (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value ? Number(e.target.value) : '')}
                        className="w-24 bg-bg-surface border border-border-default rounded px-2 py-1 text-text-base text-right text-sm focus:outline-none focus:border-[#3B82F6]"
                        autoFocus
                      />
                    ) : (
                      <span className="font-medium text-text-base">
                        {v.valor_exclusivo?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {editingId === v.id ? (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editCoparticipacao}
                        onChange={(e) => setEditCoparticipacao(e.target.value ? Number(e.target.value) : '')}
                        className="w-24 bg-bg-surface border border-border-default rounded px-2 py-1 text-text-base text-right text-sm focus:outline-none focus:border-[#3B82F6]"
                      />
                    ) : (
                      <span className="font-medium text-text-base">
                        {v.valor_coparticipacao?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    )}
                  </td>"""

if re.search(row_pattern, content):
    content = re.sub(row_pattern, replacement_row, content)
else:
    print("row_pattern not found")

# Fix colSpan in No Vinculados
content = content.replace("<td colSpan={4}", "<td colSpan={5}")

# Fix saving defaults when vinculating
vincular_replacement = """await vincularProcedimento({
            credenciado_id: credenciadoId,
            procedimento_id: proc.id,
            valor_exclusivo: proc.valor_padrao || 0,
            valor_coparticipacao: proc.valor_coparticipacao || 0
          });"""
content = re.sub(r'await vincularProcedimento\(\{\s*credenciado_id:\s*credenciadoId,\s*procedimento_id:\s*proc\.id,\s*valor_exclusivo:\s*proc\.valor_padrao\s*\|\|\s*0\s*\}\);', vincular_replacement, content)

# Fix edit handler
handle_update_replacement = """const handleUpdate = async (id: string) => {
    try {
      await atualizarValorProcedimento(id, {
        valor_exclusivo: editValue === '' ? 0 : editValue,
        valor_coparticipacao: editCoparticipacao === '' ? 0 : editCoparticipacao
      });
      toast.success('Valores atualizados com sucesso!');
      setEditingId(null);
      await loadVinculados();
    } catch (err) {
      toast.error('Erro ao atualizar valores.');
    }
  };"""

content = re.sub(r'const handleUpdate = async \(id: string\) => \{.*?toast\.error\(\'Erro ao atualizar valor\.\'\);\s*\}\s*\};', handle_update_replacement, content, flags=re.DOTALL)


# Fix SetEditValue click
set_edit_value_pattern = r"setEditValue\(v\.valor_exclusivo \|\| v\.procedimentos\?\.valor_padrao \|\| 0\);"
set_edit_value_replacement = """setEditValue(v.valor_exclusivo || v.procedimentos?.valor_padrao || 0);
                              setEditCoparticipacao(v.valor_coparticipacao || v.procedimentos?.valor_coparticipacao || 0);"""

content = re.sub(set_edit_value_pattern, set_edit_value_replacement, content)

with open('src/components/credenciados/ProcedimentosCredenciado.tsx', 'w') as f:
    f.write(content)

