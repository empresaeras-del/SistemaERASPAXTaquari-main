import re

with open('src/pages/Configuracoes.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    'const [activeTab, setActiveTab] = useState<"empresas" | "usuarios" | "sistema">',
    'const [activeTab, setActiveTab] = useState<"empresas" | "usuarios" | "sistema" | "mensagens">'
)

tab_sistema_html = """          <button
            onClick={() => setActiveTab("sistema")}
            className={`flex items-center gap-2 px-6 py-3 font-medium text-sm transition-colors border-b-2 ${
              activeTab === "sistema"
                ? "border-[#7E4CF3] text-[#7E4CF3]"
                : "border-transparent text-slate-400 hover:text-slate-200 hover:border-[#262A45]"
            }`}
          >
            <Database className="w-4 h-4" />
            Sistema / Backup
          </button>"""

tab_mensagens_html = """          <button
            onClick={() => setActiveTab("sistema")}
            className={`flex items-center gap-2 px-6 py-3 font-medium text-sm transition-colors border-b-2 ${
              activeTab === "sistema"
                ? "border-[#7E4CF3] text-[#7E4CF3]"
                : "border-transparent text-slate-400 hover:text-slate-200 hover:border-[#262A45]"
            }`}
          >
            <Database className="w-4 h-4" />
            Sistema / Backup
          </button>
          
          <button
            onClick={() => setActiveTab("mensagens")}
            className={`flex items-center gap-2 px-6 py-3 font-medium text-sm transition-colors border-b-2 ${
              activeTab === "mensagens"
                ? "border-[#7E4CF3] text-[#7E4CF3]"
                : "border-transparent text-slate-400 hover:text-slate-200 hover:border-[#262A45]"
            }`}
          >
            <MessageCircle className="w-4 h-4" />
            Mensagens e Templates
          </button>"""

content = content.replace(tab_sistema_html, tab_mensagens_html)

with open('src/pages/Configuracoes.tsx', 'w') as f:
    f.write(content)
