import re

files = [
    'src/pages/ContasPagarPage.tsx',
    'src/pages/ContasReceberPage.tsx'
]

effect_code = """
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

for file in files:
    with open(file, 'r') as f:
        content = f.read()
    
    # Remove old effect code
    content = content.replace(effect_code, '')
    
    # Insert after `const [searchTerm, setSearchTerm] = useState('');`
    target = "const [searchTerm, setSearchTerm] = useState('');"
    
    if target in content:
        content = content.replace(target, target + "\n" + effect_code)
    
    with open(file, 'w') as f:
        f.write(content)
        print(f"Fixed {file}")

