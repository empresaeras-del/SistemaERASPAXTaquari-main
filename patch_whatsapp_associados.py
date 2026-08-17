import re

with open('src/pages/Associados.tsx', 'r') as f:
    content = f.read()

if 'MessageCircle' not in content:
    content = content.replace('import { Phone,', 'import { MessageCircle, Phone,')

if 'sendWhatsAppMessage' not in content:
    content = content.replace("import { format, addMonths } from \"date-fns\";", "import { format, addMonths } from \"date-fns\";\nimport { sendWhatsAppMessage, generateBoasVindasTemplate, generateRenovacaoTemplate } from '../utils/whatsapp';")

handle_func = """  const [isEditingMode, setIsEditingMode] = useState(false);

  const handleWhatsAppMenu = (associado: Associado) => {
    const opcao = window.prompt(
      `Enviar WhatsApp para ${associado.nome}\\n\\nDigite o número da opção:\\n1 - Boas Vindas\\n2 - Lembrete de Renovação\\n3 - Mensagem Livre`,
      "1"
    );
    
    if (!opcao) return;
    
    let msg = "";
    if (opcao === "1") {
      msg = generateBoasVindasTemplate(associado.nome);
    } else if (opcao === "2") {
      msg = generateRenovacaoTemplate(associado.nome, associado.plano || "");
    }
    
    const phone = associado.telefone || window.prompt(`WhatsApp de ${associado.nome} (com DDD):`, "");
    if (phone) {
        const success = sendWhatsAppMessage(phone, msg);
        if (!success) toast.error("Número de telefone inválido.");
    }
  };
"""
content = content.replace('  const [isEditingMode, setIsEditingMode] = useState(false);', handle_func)

find_actions_list = """                        <button
                          onClick={(e) => { e.stopPropagation(); handleOpenModal(associado); }}
                          className="p-1 text-text-subtle hover:text-text-base hover:bg-white/5 rounded-lg transition-colors"
                          title="Editar Associado"
                        >"""

replace_actions_list = """                        <button
                          onClick={(e) => { e.stopPropagation(); handleWhatsAppMenu(associado); }}
                          className="p-1 text-emerald-500/70 hover:text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-colors"
                          title="WhatsApp Automático"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleOpenModal(associado); }}
                          className="p-1 text-text-subtle hover:text-text-base hover:bg-white/5 rounded-lg transition-colors"
                          title="Editar Associado"
                        >"""

content = content.replace(find_actions_list, replace_actions_list)

find_actions_grid = """                      <button
                        onClick={(e) => { e.stopPropagation(); handleOpenModal(associado); }}
                        className="p-1.5 text-text-subtle hover:text-text-base hover:bg-white/5 rounded-lg transition-colors"
                        title="Editar Associado"
                      >"""

replace_actions_grid = """                      <button
                        onClick={(e) => { e.stopPropagation(); handleWhatsAppMenu(associado); }}
                        className="p-1.5 text-emerald-500/70 hover:text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-colors"
                        title="WhatsApp Automático"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleOpenModal(associado); }}
                        className="p-1.5 text-text-subtle hover:text-text-base hover:bg-white/5 rounded-lg transition-colors"
                        title="Editar Associado"
                      >"""

content = content.replace(find_actions_grid, replace_actions_grid)

with open('src/pages/Associados.tsx', 'w') as f:
    f.write(content)
