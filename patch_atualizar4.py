import re
with open('src/pages/RequisicoesPage.tsx', 'r') as f:
    content = f.read()

target = r"""      // Gerar Conta a Receber se houver Co-participação
      const valorTotalAssociado = itensGuia.reduce\(\(acc, i\) => acc \+ \(i.valor_coparticipacao \|\| 0\), 0\);
      if \(valorTotalAssociado > 0\) \{
        const dPlus2 = new Date\(\);
        dPlus2.setDate\(dPlus2.getDate\(\) \+ 2\);
        const dataVencimento = dPlus2.toISOString\(\);
        const dataEmissao = new Date\(\).toISOString\(\);

        const novaReceita: Receita = \{
          id: crypto.randomUUID\(\),
          tenant_id: tenantId,
          tipo_devedor: 'associado',
          associado_id: associadoSelecionado.id,
          associado_nome: associadoSelecionado.nome,
          associado_cpf: associadoSelecionado.cpf,
          descricao: `Co-participação - Guia \$\{novaReq.codigo_requisicao\}`,
          categoria: 'Serviço Extra',
          data_emissao: dataEmissao,
          data_inicio_cobranca: dataVencimento,
          valor_total: valorTotalAssociado,
          qtd_parcelas: 1,
          forma_pagamento_padrao: 'pix'
        \};

        const parcelaUnica: ParcelaReceber = \{
          id: crypto.randomUUID\(\),
          tenant_id: tenantId,
          receita_id: novaReceita.id,
          numero_parcela: 1,
          valor: valorTotalAssociado,
          data_vencimento: dataVencimento,
          status: 'pendente',
          forma_pagamento: 'pix'
        \};

        await salvarReceita\(state.isOnline, novaReceita, \[parcelaUnica\]\);
        toast.success\(`Conta a Receber \(Co-part.\) gerada com sucesso!`\);
      \}"""

repl = """      // Gerar Conta a Receber se houver Co-participação
      const valorTotalAssociado = itensGuia.reduce((acc, i) => acc + (i.valor_coparticipacao || 0), 0);
      if (valorTotalAssociado > 0) {
        const dPlus2 = new Date();
        dPlus2.setDate(dPlus2.getDate() + 2);
        const dataVencimento = dPlus2.toISOString();
        const dataEmissao = new Date().toISOString();

        const novaReceita: Receita = {
          id: crypto.randomUUID(),
          tenant_id: tenantId,
          tipo_devedor: 'associado',
          associado_id: associadoSelecionado.id,
          associado_nome: associadoSelecionado.nome,
          associado_cpf: associadoSelecionado.cpf,
          descricao: `Co-participação - Guia ${novaReq.codigo_requisicao || 'Atualizada'}`,
          categoria: 'Serviço Extra',
          data_emissao: dataEmissao,
          data_inicio_cobranca: dataVencimento,
          valor_total: valorTotalAssociado,
          qtd_parcelas: 1,
          forma_pagamento_padrao: 'pix'
        };

        const parcelaUnica: ParcelaReceber = {
          id: crypto.randomUUID(),
          tenant_id: tenantId,
          receita_id: novaReceita.id,
          numero_parcela: 1,
          valor: valorTotalAssociado,
          data_vencimento: dataVencimento,
          status: 'pendente',
          forma_pagamento: 'pix'
        };

        await salvarReceita(state.isOnline, novaReceita, [parcelaUnica]);
        toast.success(`Conta a Receber (Co-part.) gerada com sucesso!`);
      }"""

content = re.sub(target, repl, content)
with open('src/pages/RequisicoesPage.tsx', 'w') as f:
    f.write(content)
