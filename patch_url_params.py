import re
with open('src/pages/RequisicoesPage.tsx', 'r') as f:
    content = f.read()

# Add useSearchParams import if not present
if "useSearchParams" not in content:
    content = content.replace("import { useState, useEffect, useMemo } from 'react';", "import { useState, useEffect, useMemo } from 'react';\nimport { useSearchParams, useNavigate } from 'react-router-dom';")

# Read params on load
target_useeffect = r"""  useEffect\(\(\) => \{
    loadData\(\);
  \}, \[state.isOnline, state.empresaSelecionada\]\);"""

repl_useeffect = """  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, [state.isOnline, state.empresaSelecionada]);

  // Handle URL Params for creating new requisition
  useEffect(() => {
    if (associados.length > 0) {
      const pAssociadoId = searchParams.get('associadoId');
      const pAction = searchParams.get('action');
      
      if (pAction === 'new' && pAssociadoId) {
        setSelAssociadoId(pAssociadoId);
        setModalNovaGuia(true);
        // Clear params to avoid reopening on refresh
        navigate('/requisicoes', { replace: true });
      }
    }
  }, [associados, searchParams, navigate]);"""

content = re.sub(target_useeffect, repl_useeffect, content)

with open('src/pages/RequisicoesPage.tsx', 'w') as f:
    f.write(content)
