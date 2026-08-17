import re

with open('src/pages/ContasReceberPage.tsx', 'r') as f:
    content = f.read()

# Add imports
if 'MessageCircle' not in content:
    content = content.replace('import {', 'import { MessageCircle,', 1)

if 'sendWhatsAppMessage' not in content:
    content = content.replace("import toast from 'react-hot-toast';", "import toast from 'react-hot-toast';\nimport { sendWhatsAppMessage, generateCobrançaTemplate } from '../utils/whatsapp';")

# Add handle function
handle_func = """  const { confirm } = useConfirm();

  const handleWhatsAppCobrança = (parcela: ParcelaReceber) => {
    // Assuming parcela has telefone somewhere, if not we need to find it from associado or cliente
    // But ParcelaReceber might not have 'telefone' natively, let's look at its fields
    // Wait, let's prompt the user or just use a generic prompt if no phone is found
    // If phone is missing, we'll try to ask for it
    const msg = generateCobrançaTemplate(
      parcela.devedor_nome || 'Cliente', 
      parcela.valor, 
      format(new Date(parcela.data_vencimento), 'dd/MM/yyyy')
    );
    
    // In many cases, phone is not in ParcelaReceber, so we might need to prompt
    // For now we'll just open a modal to enter phone, OR if there's a known phone, use it.
    // Let's use prompt for simplicity if phone is unknown.
    const phonePrompt = window.prompt("Digite o número de WhatsApp do cliente (com DDD):", "");
    if (phonePrompt) {
        const success = sendWhatsAppMessage(phonePrompt, msg);
        if (!success) toast.error("Número de telefone inválido.");
    }
  };
"""

# Let's check ParcelaReceber type to see if it has telefone.
# We don't have it explicitly. So prompt is a safe fallback.
# Or better, let's create a more elegant prompt.
