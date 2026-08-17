import re

with open('src/pages/ContasPagarPage.tsx', 'r') as f:
    content = f.read()

# Add button
old_buttons = """                <button
                  onClick={() => setShowDetalhesModal(false)}
                  className="px-5 py-2 rounded-xl bg-bg-surface border border-border-default text-text-muted hover:text-text-base transition-colors font-medium text-sm"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>"""

new_buttons = """                {parcelaDetalhes.status === 'pago' && (
                  <button
                    onClick={() => {
                      setTimeout(() => {
                        window.print();
                      }, 100);
                    }}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-medium text-sm transition-colors"
                  >
                    <Printer className="w-4 h-4" />
                    Imprimir Recibo
                  </button>
                )}
                <button
                  onClick={() => setShowDetalhesModal(false)}
                  className="px-5 py-2 rounded-xl bg-bg-surface border border-border-default text-text-muted hover:text-text-base transition-colors font-medium text-sm"
                >
                  Fechar
                </button>
              </div>
            </div>

            {/* Comprovante de Pagamento - Somente Impressão */}
            <div className="hidden print:block p-8 font-sans bg-white text-black print:!bg-white print:!text-black">
              <div className="text-center border-b-2 border-black pb-4 mb-6">
                <h1 className="text-3xl font-bold uppercase tracking-wider mb-2">Comprovante de Pagamento</h1>
                <p className="text-gray-600">Nº {parcelaDetalhes.id.split('-')[0].toUpperCase()}</p>
              </div>

              <div className="flex justify-between items-center mb-8">
                <div>
                  <p className="text-gray-600 text-sm uppercase font-bold">Data de Emissão</p>
                  <p className="font-medium text-lg">{format(new Date(), "dd/MM/yyyy")}</p>
                </div>
                <div className="text-right">
                  <p className="text-gray-600 text-sm uppercase font-bold">Valor Pago</p>
                  <p className="font-bold text-2xl">
                    {Number(parcelaDetalhes.valor_pago || parcelaDetalhes.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <p className="text-gray-600 text-sm uppercase font-bold mb-1">Pago para:</p>
                  <div className="border border-gray-300 p-4 rounded-lg bg-gray-50">
                    <p className="font-bold text-lg">{parcelaDetalhes.credor_nome || 'Credor'}</p>
                    <p className="text-gray-700">CPF/CNPJ: {parcelaDetalhes.credor_cpf_cnpj || 'Não informado'}</p>
                  </div>
                </div>

                <div>
                  <p className="text-gray-600 text-sm uppercase font-bold mb-1">Referente a:</p>
                  <div className="border border-gray-300 p-4 rounded-lg bg-gray-50">
                    <p className="font-medium text-lg">{parcelaDetalhes.descricao || 'Despesa'}</p>
                    <p className="text-gray-700">Parcela: {parcelaDetalhes.numero_parcela} de {parcelaDetalhes.total_parcelas || 1}</p>
                    <p className="text-gray-700">Forma Efetiva: {parcelaDetalhes.forma_pagamento_efetivo || 'Não informado'}</p>
                    <p className="text-gray-700">Data Efetiva: {parcelaDetalhes.data_pagamento ? format(new Date(parcelaDetalhes.data_pagamento), "dd/MM/yyyy") : 'Não informado'}</p>
                  </div>
                </div>
              </div>

              <div className="mt-20 pt-8 border-t-2 border-black flex flex-col items-center">
                <div className="w-64 border-b border-black mb-2"></div>
                <p className="text-sm font-bold uppercase tracking-wider">Assinatura / Carimbo</p>
                <p className="text-xs text-gray-500 mt-1">Este recibo comprova o pagamento do valor especificado acima.</p>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>"""

content = content.replace(old_buttons, new_buttons)

with open('src/pages/ContasPagarPage.tsx', 'w') as f:
    f.write(content)

