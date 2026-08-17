import re
with open('src/components/associados/AssociadoRequisicoesTab.tsx', 'r') as f:
    content = f.read()

# Add useNavigate
if "useNavigate" not in content:
    content = content.replace("import React, { useState, useEffect } from 'react';", "import React, { useState, useEffect } from 'react';\nimport { useNavigate } from 'react-router-dom';")

target_button = r"""      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border-default pb-4">
        <div>
          <h4 className="text-text-base font-medium flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" />
            Requisições Emitidas
          </h4>
          <p className="text-xs text-text-subtle mt-1">Guia de procedimentos e atendimentos de rede credenciada vinculados a este associado.</p>
        </div>
      </div>"""

repl_button = """      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border-default pb-4">
        <div>
          <h4 className="text-text-base font-medium flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" />
            Requisições Emitidas
          </h4>
          <p className="text-xs text-text-subtle mt-1">Guia de procedimentos e atendimentos de rede credenciada vinculados a este associado.</p>
        </div>
        
        <button
          onClick={() => {
             // Navigation will be done via useNavigate hook
             navigate(`/requisicoes?associadoId=${associado.id}&action=new`);
          }}
          className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-sm font-medium shadow-lg shadow-primary/20 transition-all flex items-center gap-2 whitespace-nowrap"
        >
          <ClipboardList className="w-4 h-4" />
          <span>Nova Requisição</span>
        </button>
      </div>"""

content = re.sub(target_button, repl_button, content)

# Initialize useNavigate inside component
target_hook = r"""export const AssociadoRequisicoesTab: React.FC<AssociadoRequisicoesTabProps> = \(\{ associado \}\) => \{
  const \{ state \} = useAppContext\(\);"""

repl_hook = """export const AssociadoRequisicoesTab: React.FC<AssociadoRequisicoesTabProps> = ({ associado }) => {
  const navigate = useNavigate();
  const { state } = useAppContext();"""

content = re.sub(target_hook, repl_hook, content)

with open('src/components/associados/AssociadoRequisicoesTab.tsx', 'w') as f:
    f.write(content)
