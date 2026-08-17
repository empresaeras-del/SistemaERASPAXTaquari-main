import re

files = [
    ('src/pages/ContasPagarPage.tsx', 'parcelaDetalhes'),
    ('src/pages/ContasReceberPage.tsx', 'parcelaDetalhes')
]

for file, state_var in files:
    with open(file, 'r') as f:
        content = f.read()
    
    # We will insert it after "  const { confirm } = useConfirm();"
    # Find that line
    target_line = "  const { confirm } = useConfirm();"
    
    insert_code = """
  useEffect(() => {
    if (parcelas.length > 0 && location.state?.openDetails) {
      const p = parcelas.find((x: any) => x.id === location.state.openDetails);
      if (p) {
        setParcelaDetalhes(p);
        setShowDetalhesModal(true);
        navigate(location.pathname, { replace: true, state: {} });
      }
    }
  }, [parcelas, location.state, navigate, location.pathname]);
"""
    
    if target_line in content and "location.state?.openDetails" not in content:
        content = content.replace(target_line, target_line + "\n" + insert_code)
        
        with open(file, 'w') as f:
            f.write(content)
            print(f"Updated {file}")

