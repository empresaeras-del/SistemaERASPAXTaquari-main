import re

with open('src/pages/Associados.tsx', 'r') as f:
    content = f.read()

state_addition = """
  const [justificativaModificacao, setJustificativaModificacao] = useState("");
  const [novoPlanoSelecionado, setNovoPlanoSelecionado] = useState("");
  const [parcelasAbertasMap, setParcelasAbertasMap] = useState<Record<string, number>>({});
"""

content = content.replace('  const [justificativaModificacao, setJustificativaModificacao] = useState("");\n  const [novoPlanoSelecionado, setNovoPlanoSelecionado] = useState("");', state_addition)

loadData_addition = """  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getAssociados(
        state.isOnline,
        state.empresaSelecionada,
      );
      setAssociados(data);

      const allParcelas = await getParcelasReceber(state.isOnline, state.empresaSelecionada || 'all');
      const pMap: Record<string, number> = {};
      data.forEach(a => {
        pMap[a.id] = 0;
      });

      allParcelas.forEach(p => {
        if (p.status === 'pendente' || p.status === 'vencido' || p.status === 'atrasado') {
          const assoc = data.find(a => 
            (a.cpf && p.devedor_cpf_cnpj && a.cpf === p.devedor_cpf_cnpj) || 
            (p.devedor_nome === a.nome)
          );
          if (assoc) {
            pMap[assoc.id] = (pMap[assoc.id] || 0) + 1;
          }
        }
      });
      setParcelasAbertasMap(pMap);
    } catch (e) {
"""

content = re.sub(r'  const loadData = async \(\) => \{\n    setLoading\(true\);\n    try \{\n      const data = await getAssociados\(\n        state.isOnline,\n        state.empresaSelecionada,\n      \);\n      setAssociados\(data\);\n    \} catch \(e\) \{', loadData_addition, content)


with open('src/pages/Associados.tsx', 'w') as f:
    f.write(content)
