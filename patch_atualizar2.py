import re
with open('src/pages/RequisicoesPage.tsx', 'r') as f:
    content = f.read()

target = r"""    try {
      const novaReq = await criarRequisicao\(state.isOnline, tenantId, {
        tenant_id: tenantId,
        associado_id: associadoSelecionado.id,
        associado_nome: associadoSelecionado.nome,
        associado_cpf: associadoSelecionado.cpf,
        associado_plano: associadoSelecionado.plano_nome,
        paciente_tipo: selPacienteTipo,
        paciente_id: pacienteId,
        paciente_nome: pacienteNome,
        paciente_cpf: pacienteCpf,
        paciente_parentesco: pacienteParentesco,
        tipo_prestador: tipoPrestador,
        credenciado_id: tipoPrestador === 'credenciado' \? selCredenciadoId : undefined,
        credenciado_nome: credNome,
        credenciado_cnpj_cpf: credCnpj,
        medico_solicitante: medicoSolicitante,
        crm_solicitante: crmSolicitante,
        itens: itensGuia,
        valor_total: valorTotal,
        status: 'emitida',
        observacoes
      }\);"""

repl = """    try {
      const reqData: Partial<Requisicao> = {
        tenant_id: tenantId,
        associado_id: associadoSelecionado.id,
        associado_nome: associadoSelecionado.nome,
        associado_cpf: associadoSelecionado.cpf,
        associado_plano: associadoSelecionado.plano_nome,
        paciente_tipo: selPacienteTipo,
        paciente_id: pacienteId,
        paciente_nome: pacienteNome,
        paciente_cpf: pacienteCpf,
        paciente_parentesco: pacienteParentesco,
        tipo_prestador: tipoPrestador,
        credenciado_id: tipoPrestador === 'credenciado' ? selCredenciadoId : undefined,
        credenciado_nome: credNome,
        credenciado_cnpj_cpf: credCnpj,
        medico_solicitante: medicoSolicitante,
        crm_solicitante: crmSolicitante,
        itens: itensGuia,
        valor_total: valorTotal,
        observacoes: observacoes
      };

      let novaReq;
      if (editingRequisicao) {
        reqData.id = editingRequisicao.id;
        novaReq = await atualizarRequisicao(state.isOnline, { ...editingRequisicao, ...reqData });
      } else {
        reqData.status = 'emitida';
        novaReq = await criarRequisicao(state.isOnline, tenantId, reqData as any);
      }"""

content = re.sub(target, repl, content)
with open('src/pages/RequisicoesPage.tsx', 'w') as f:
    f.write(content)
