import re

with open('src/pages/ContasReceberPage.tsx', 'r') as f:
    content = f.read()

if 'MessageCircle' not in content:
    content = content.replace('import {  Search,', 'import {  MessageCircle, Search,')

if 'sendWhatsAppMessage' not in content:
    content = content.replace("import toast from 'react-hot-toast';", "import toast from 'react-hot-toast';\nimport { sendWhatsAppMessage, generateCobrançaTemplate } from '../utils/whatsapp';")

handle_func = """  const { confirm } = useConfirm();

  const handleWhatsAppCobrança = (parcela: ParcelaReceber) => {
    const msg = generateCobrançaTemplate(
      parcela.devedor_nome || 'Cliente', 
      parcela.valor, 
      format(new Date(parcela.data_vencimento), 'dd/MM/yyyy')
    );
    const phonePrompt = window.prompt("Confirme ou digite o WhatsApp do cliente (com DDD):", "");
    if (phonePrompt) {
        const success = sendWhatsAppMessage(phonePrompt, msg);
        if (!success) toast.error("Número de telefone inválido.");
    }
  };
"""
content = content.replace('  const { confirm } = useConfirm();', handle_func)

find_actions = """                        {/* Ver Detalhes */}
                        <button
                          onClick={() => openDetalhes(parcela)}"""

replace_actions = """                        {/* WhatsApp Cobrança */}
                        <button
                          onClick={() => handleWhatsAppCobrança(parcela)}
                          title="Enviar Cobrança via WhatsApp"
                          className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 transition-colors"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </button>
                        
                        {/* Ver Detalhes */}
                        <button
                          onClick={() => openDetalhes(parcela)}"""

content = content.replace(find_actions, replace_actions)

with open('src/pages/ContasReceberPage.tsx', 'w') as f:
    f.write(content)

