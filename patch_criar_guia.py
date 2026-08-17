import re

with open('src/pages/RequisicoesPage.tsx', 'r') as f:
    content = f.read()

# Add import
import_stmt = "import { salvarReceita, Receita, ParcelaReceber } from '../services/financeiroService';\n"
if "import { salvarReceita" not in content:
    content = content.replace("import { getRemessas } from '../services/faturamentoService';", "import { getRemessas } from '../services/faturamentoService';\n" + import_stmt)


target_create = """      toast.success(`Guia ${novaReq.codigo_requisicao} emitida com sucesso!`);
      setModalNovaGuia(false);
      resetForm();
      await loadData();

      // Offer printing
      const empresa = await getEmpresaById(tenantId, state.isOnline);
      await gerarPDFGuiaRequisicao(novaReq, empresa);"""

repl_create = """      // Gerar Conta a Receber se houver Co-participação
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
          descricao: `Co-participação - Guia ${novaReq.codigo_requisicao}`,
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
      }

      toast.success(`Guia ${novaReq.codigo_requisicao} emitida com sucesso!`);
      setModalNovaGuia(false);
      resetForm();
      await loadData();

      // Offer printing
      const empresa = await getEmpresaById(tenantId, state.isOnline);
      await gerarPDFGuiaRequisicao(novaReq, empresa);"""

content = content.replace(target_create, repl_create)

with open('src/pages/RequisicoesPage.tsx', 'w') as f:
    f.write(content)
