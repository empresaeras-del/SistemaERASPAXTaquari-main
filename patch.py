with open('src/pages/RequisicoesPage.tsx', 'r') as f:
    content = f.read()

target = """  // Available Procedures list depending on Provider Type
  const listaProcedimentosDisponiveis = useMemo(() => {
    if (tipoPrestador === 'credenciado' && procedimentosVinculados.length > 0) {
      return procedimentosVinculados.map(pv => ({
        id: pv.procedimentos?.id || pv.procedimento_id,
        codigo_tuss: pv.procedimentos?.codigo_tuss || '',
        descricao: pv.procedimentos?.descricao || 'Procedimento Credenciado',
        valor: pv.valor_exclusivo !== null && pv.valor_exclusivo !== undefined 
          ? Number(pv.valor_exclusivo) 
          : Number(pv.procedimentos?.valor_padrao || 0)
      }));
    }

    // General master active procedures list
    return todosProcedimentos
      .filter(p => p.ativo)
      .map(p => ({
        id: p.id,
        codigo_tuss: p.codigo_tuss,
        descricao: p.descricao,
        valor: Number(p.valor_padrao || 0)
      }));
  }, [tipoPrestador, procedimentosVinculados, todosProcedimentos]);"""

replacement = """  // Available Procedures list depending on Provider Type
  const listaProcedimentosDisponiveis = useMemo(() => {
    if (tipoPrestador === 'credenciado' && procedimentosVinculados.length > 0) {
      return procedimentosVinculados.map(pv => ({
        id: pv.procedimentos?.id || pv.procedimento_id,
        codigo_tuss: pv.procedimentos?.codigo_tuss || '',
        descricao: pv.procedimentos?.descricao || 'Procedimento Credenciado',
        valor: pv.valor_exclusivo !== null && pv.valor_exclusivo !== undefined 
          ? Number(pv.valor_exclusivo) 
          : Number(pv.procedimentos?.valor_padrao || 0),
        valor_coparticipacao: pv.valor_coparticipacao !== null && pv.valor_coparticipacao !== undefined 
          ? Number(pv.valor_coparticipacao) 
          : Number(pv.procedimentos?.valor_coparticipacao || 0)
      }));
    }

    // General master active procedures list
    return todosProcedimentos
      .filter(p => p.ativo)
      .map(p => ({
        id: p.id,
        codigo_tuss: p.codigo_tuss,
        descricao: p.descricao,
        valor: Number(p.valor_padrao || 0),
        valor_coparticipacao: Number(p.valor_coparticipacao || 0)
      }));
  }, [tipoPrestador, procedimentosVinculados, todosProcedimentos]);"""

content = content.replace(target, replacement)

# also add it to handleAdicionarItem and resetForm
# I'll use regex for handleAdicionarItem
import re

adicionar_target = r"""    const valorUnitario = valorCustomProc !== '' \? Number\(valorCustomProc\) : procObj\.valor;
    const qtd = Number\(qtdProc\) \|\| 1;

    const novoItem: RequisicaoItem = \{
      id: crypto\.randomUUID\(\),
      procedimento_id: procObj\.id,
      codigo_tuss: procObj\.codigo_tuss,
      descricao: procObj\.descricao,
      quantidade: qtd,
      valor_unitario: valorUnitario,
      valor_total: valorUnitario \* qtd
    \};"""

adicionar_repl = """    const valorUnitario = valorCustomProc !== '' ? Number(valorCustomProc) : procObj.valor;
    const valorCoparticipacao = coparticipacaoCustomProc !== '' ? Number(coparticipacaoCustomProc) : (procObj.valor_coparticipacao || 0);
    const qtd = Number(qtdProc) || 1;

    const novoItem: RequisicaoItem = {
      id: crypto.randomUUID(),
      procedimento_id: procObj.id,
      codigo_tuss: procObj.codigo_tuss,
      descricao: procObj.descricao,
      quantidade: qtd,
      valor_unitario: valorUnitario,
      valor_coparticipacao: valorCoparticipacao,
      valor_total: valorUnitario * qtd
    };"""

content = re.sub(adicionar_target, adicionar_repl, content)

content = content.replace(
    "setValorCustomProc('');\n  };",
    "setValorCustomProc('');\n    setCoparticipacaoCustomProc('');\n  };"
)

content = content.replace(
    "setValorCustomProc('');\n    setItensGuia([]);",
    "setValorCustomProc('');\n    setCoparticipacaoCustomProc('');\n    setItensGuia([]);"
)


with open('src/pages/RequisicoesPage.tsx', 'w') as f:
    f.write(content)
