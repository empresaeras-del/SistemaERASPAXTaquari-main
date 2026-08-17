import re

with open('src/pages/PlanosPaxPage.tsx', 'r') as f:
    content = f.read()

# ADD IMPORTS
if 'import { ShieldCheck, ShieldAlert, ArrowRightLeft, Trash2, User, Users, CircleDollarSign, Check, Clock, MapPin, Building2, Plus, Search, Pencil, Power, PowerOff, LayoutGrid, List, Filter }' not in content:
    content = content.replace("import { Plus, Search, Pencil, Power, PowerOff, ShieldCheck, ShieldAlert, ArrowRightLeft, Trash2, User, Users, CircleDollarSign, Check, Clock, MapPin } from 'lucide-react';", "import { Building2, Plus, Search, Pencil, Power, PowerOff, ShieldCheck, ShieldAlert, ArrowRightLeft, Trash2, User, Users, CircleDollarSign, Check, Clock, MapPin, LayoutGrid, List, Filter } from 'lucide-react';")

# ADD viewMode state
if 'const [viewMode, setViewMode] = useState<' not in content:
    content = content.replace('const [filtros, setFiltros] = useState({', 'const [viewMode, setViewMode] = useState<"grid" | "table">("grid");\n  const [filtros, setFiltros] = useState({')

search_bar_old = """
      <div className="bg-bg-subtle border border-border-default rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border-default flex flex-col sm:flex-row gap-4 justify-between bg-bg-surface/50">
          <div className="relative w-full max-w-md">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" />
            <input
              type="text"
              placeholder="Buscar por código ou nome..."
              value={filtros.busca}
              onChange={(e) => setFiltros(prev => ({ ...prev, busca: e.target.value }))}
              className="w-full bg-bg-surface border border-border-default rounded-xl pl-10 pr-4 py-2.5 text-text-base focus:outline-none focus:border-[#3B82F6]"
            />
          </div>
            
          <div className="flex gap-4">
"""

search_bar_new = """
      <div className="bg-bg-surface p-2 rounded-2xl border border-border-default shadow-sm flex items-center justify-between gap-4 mt-6">
        <div className="relative flex-1 max-w-2xl">
          <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Buscar por código ou nome..."
            value={filtros.busca || ''}
            onChange={(e) => setFiltros(prev => ({ ...prev, busca: e.target.value }))}
            className="w-full bg-transparent pl-12 pr-4 py-3 text-text-base focus:outline-none placeholder:text-text-muted"
          />
        </div>
            
        <div className="flex items-center gap-2 flex-wrap text-xs px-2">
          <div className="flex items-center gap-1 text-text-subtle mr-1 hidden md:flex">
            <Filter className="w-3.5 h-3.5" />
            <span className="font-semibold">Filtros:</span>
          </div>
"""

content = content.replace(search_bar_old, search_bar_new)

# Table layout start
table_start_old = """
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
"""

table_start_new = """
            </select>
          </div>

        {/* VIEW MODE TOGGLES */}
        <div className="flex items-center gap-2 border-l border-border-default pl-4 pr-2">
          <div className="flex items-center bg-bg-subtle border border-border-default rounded-xl p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-[#3B82F6] text-white' : 'text-text-subtle hover:text-text-base'}`}
              title="Visualização em Cards"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-colors ${viewMode === 'table' ? 'bg-[#3B82F6] text-white' : 'text-text-subtle hover:text-text-base'}`}
              title="Visualização em Tabela"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto flex-1 min-h-0 overflow-y-auto w-full">
        {loading ? (
"""

content = content.replace(table_start_old, table_start_new)

with open('src/pages/PlanosPaxPage.tsx', 'w') as f:
    f.write(content)

