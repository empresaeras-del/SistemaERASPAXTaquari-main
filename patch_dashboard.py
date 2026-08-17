import re

with open('src/pages/Dashboard.tsx', 'r') as f:
    content = f.read()

# Add states
if "const [filtroReceitas, setFiltroReceitas]" not in content:
    content = content.replace("const [layout, setLayout] = useState<WidgetConfig[]>(defaultWidgets);", """const [layout, setLayout] = useState<WidgetConfig[]>(defaultWidgets);
  const [filtroReceitas, setFiltroReceitas] = useState('todos');
  const [filtroDespesas, setFiltroDespesas] = useState('todos');
  
  const getValoresFinanceiros = (
    parcelas: any[],
    filtro: string,
    tipo: 'receber' | 'pagar'
  ) => {
    let projetado = 0;
    let realizado = 0;
    const hoje = new Date();
    
    (parcelas || []).forEach(p => {
      const dataVenc = new Date(p.data_vencimento + 'T12:00:00');
      let include = false;
      
      if (filtro === 'todos') {
        include = true;
      } else if (filtro === 'mensal') {
        include = dataVenc.getMonth() === hoje.getMonth() && dataVenc.getFullYear() === hoje.getFullYear();
      } else if (filtro === 'trimestral') {
        const diffMonths = (hoje.getFullYear() - dataVenc.getFullYear()) * 12 + (hoje.getMonth() - dataVenc.getMonth());
        include = diffMonths >= 0 && diffMonths < 3;
      } else if (filtro === 'anual') {
        include = dataVenc.getFullYear() === hoje.getFullYear();
      }
      
      if (include) {
        if (p.status !== 'cancelado') {
          projetado += p.valor;
        }
        if (tipo === 'receber' && p.status === 'recebido') {
          realizado += (p.valor_recebido || p.valor);
        } else if (tipo === 'pagar' && p.status === 'pago') {
          realizado += (p.valor_pago || p.valor);
        }
      }
    });
    
    return { projetado, realizado };
  };""")

# Remove the buttons container from the top
top_buttons = """        <div className="flex items-center gap-2 shrink-0">
          <div className="bg-bg-subtle border border-border-default rounded-xl flex items-center p-1 shadow-sm">
            <button 
              onClick={() => setPeriod('mensal')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${period === 'mensal' ? 'bg-[#3B82F6] text-white shadow-md' : 'text-text-subtle hover:text-text-base'}`}
            >
              Mensal
            </button>
            <button 
              onClick={() => setPeriod('trimestral')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${period === 'trimestral' ? 'bg-[#3B82F6] text-white shadow-md' : 'text-text-subtle hover:text-text-base'}`}
            >
              Trimestral
            </button>
            <button 
              onClick={() => setPeriod('anual')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${period === 'anual' ? 'bg-[#3B82F6] text-white shadow-md' : 'text-text-subtle hover:text-text-base'}`}
            >
              Anual
            </button>
          </div>
          
          <button """
          
new_top_buttons = """        <div className="flex items-center gap-2 shrink-0">
          <button """

content = content.replace(top_buttons, new_top_buttons)

with open('src/pages/Dashboard.tsx', 'w') as f:
    f.write(content)
