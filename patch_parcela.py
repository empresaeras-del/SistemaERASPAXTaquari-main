import re
with open('src/pages/RequisicoesPage.tsx', 'r') as f:
    content = f.read()

target = r"""        const parcelaUnica: ParcelaReceber = \{
          id: crypto.randomUUID\(\),
          tenant_id: tenantId,
          receita_id: novaReceita.id,
          numero_parcela: 1,
          valor: valorTotalAssociado,
          data_vencimento: dataVencimento,
          status: 'pendente',
          forma_pagamento: 'pix'
        \};"""

repl = """        const parcelaUnica: ParcelaReceber = {
          id: crypto.randomUUID(),
          tenant_id: tenantId,
          receita_id: novaReceita.id,
          numero_parcela: 1,
          valor: valorTotalAssociado,
          data_vencimento: dataVencimento,
          status: 'pendente',
          forma_pagamento: 'pix',
          tipo_devedor: 'associado',
          devedor_nome: associadoSelecionado.nome,
          devedor_cpf_cnpj: associadoSelecionado.cpf,
          descricao: `Co-participação - Guia ${novaReq.codigo_requisicao || 'Atualizada'}`
        };"""

content = re.sub(target, repl, content)
with open('src/pages/RequisicoesPage.tsx', 'w') as f:
    f.write(content)
