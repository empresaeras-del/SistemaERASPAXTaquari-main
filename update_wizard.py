import re

filepath = 'src/components/atendimentos/NovoAtendimentoWizard.tsx'
with open(filepath, 'r') as f:
    content = f.read()

state_old = """  const [localVelorio, setLocalVelorio] = useState('');
  const [localSepultamento, setLocalSepultamento] = useState('');
  const [dataObito, setDataObito] = useState(format(new Date(), 'yyyy-MM-dd\\'T\\'HH:mm'));"""

state_new = """  const [localVelorio, setLocalVelorio] = useState('');
  const [localSepultamento, setLocalSepultamento] = useState('');
  const [dataObito, setDataObito] = useState(format(new Date(), 'yyyy-MM-dd\\'T\\'HH:mm'));
  const [dataVelorio, setDataVelorio] = useState('');
  const [dataSepultamento, setDataSepultamento] = useState('');"""

if state_old in content:
    content = content.replace(state_old, state_new)
else:
    print("Warning: state_old not found!")

payload_old = """        data_obito: dataObito,
        status: 'aberto',"""

payload_new = """        data_obito: dataObito,
        data_velorio: dataVelorio,
        data_sepultamento: dataSepultamento,
        status: 'aberto',"""

if payload_old in content:
    content = content.replace(payload_old, payload_new)


inputs_old = """               <div className="space-y-1">
                 <label className="block text-sm font-semibold text-text-subtle mb-1">Data do Óbito</label>
                 <input type="datetime-local" value={dataObito} onChange={(e) => setDataObito(e.target.value)} className="w-full px-4 py-2 bg-bg-surface border border-border-default rounded-xl text-text-base focus:ring-2 focus:ring-primary/50" />
               </div>
               <div className="space-y-1">
                 <label className="block text-sm font-semibold text-text-subtle mb-1">Local do Velório</label>
                 <input type="text" value={localVelorio} onChange={(e) => setLocalVelorio(e.target.value)} className="w-full px-4 py-2 bg-bg-surface border border-border-default rounded-xl text-text-base focus:ring-2 focus:ring-primary/50" />
               </div>
               <div className="space-y-1">
                 <label className="block text-sm font-semibold text-text-subtle mb-1">Local do Sepultamento</label>
                 <input type="text" value={localSepultamento} onChange={(e) => setLocalSepultamento(e.target.value)} className="w-full px-4 py-2 bg-bg-surface border border-border-default rounded-xl text-text-base focus:ring-2 focus:ring-primary/50" />
               </div>"""

inputs_new = """               <div className="space-y-1">
                 <label className="block text-sm font-semibold text-text-subtle mb-1">Data do Óbito</label>
                 <input type="datetime-local" value={dataObito} onChange={(e) => setDataObito(e.target.value)} className="w-full px-4 py-2 bg-bg-surface border border-border-default rounded-xl text-text-base focus:ring-2 focus:ring-primary/50" />
               </div>
               <div className="space-y-1">
                 <label className="block text-sm font-semibold text-text-subtle mb-1">Data do Velório</label>
                 <input type="datetime-local" value={dataVelorio} onChange={(e) => setDataVelorio(e.target.value)} className="w-full px-4 py-2 bg-bg-surface border border-border-default rounded-xl text-text-base focus:ring-2 focus:ring-primary/50" />
               </div>
               <div className="space-y-1">
                 <label className="block text-sm font-semibold text-text-subtle mb-1">Data do Sepultamento</label>
                 <input type="datetime-local" value={dataSepultamento} onChange={(e) => setDataSepultamento(e.target.value)} className="w-full px-4 py-2 bg-bg-surface border border-border-default rounded-xl text-text-base focus:ring-2 focus:ring-primary/50" />
               </div>
               <div className="space-y-1">
                 <label className="block text-sm font-semibold text-text-subtle mb-1">Local do Velório</label>
                 <input type="text" value={localVelorio} onChange={(e) => setLocalVelorio(e.target.value)} className="w-full px-4 py-2 bg-bg-surface border border-border-default rounded-xl text-text-base focus:ring-2 focus:ring-primary/50" />
               </div>
               <div className="space-y-1">
                 <label className="block text-sm font-semibold text-text-subtle mb-1">Local do Sepultamento</label>
                 <input type="text" value={localSepultamento} onChange={(e) => setLocalSepultamento(e.target.value)} className="w-full px-4 py-2 bg-bg-surface border border-border-default rounded-xl text-text-base focus:ring-2 focus:ring-primary/50" />
               </div>"""

if inputs_old in content:
    content = content.replace(inputs_old, inputs_new)
else:
    print("Warning: inputs_old not found!")

with open(filepath, 'w') as f:
    f.write(content)

