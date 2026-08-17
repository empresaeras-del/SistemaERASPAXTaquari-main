import sys

with open('src/components/layout/Sidebar.tsx', 'r') as f:
    content = f.read()

replacement = """        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-text-base tracking-tight">ERAS<span className="text-transparent bg-clip-text bg-gradient-to-r from-[#3B82F6] to-[#60A5FA]">.</span></h1>
            <button 
              onClick={() => window.dispatchEvent(new CustomEvent('open-welcome-modal'))}
              className="text-text-subtle hover:text-[#3B82F6] transition-colors"
              title="Informações do Sistema"
            >
              <Info className="w-4 h-4" />
            </button>
          </div>
        )}"""

content = content.replace("""        {!isCollapsed && (
          <h1 className="text-xl font-bold text-text-base tracking-tight">ERAS<span className="text-transparent bg-clip-text bg-gradient-to-r from-[#3B82F6] to-[#60A5FA]">.</span></h1>
        )}""", replacement)

with open('src/components/layout/Sidebar.tsx', 'w') as f:
    f.write(content)

