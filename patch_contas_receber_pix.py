import re

with open('src/pages/ContasReceberPage.tsx', 'r') as f:
    content = f.read()

# Add QrCode import
if 'QrCode' not in content:
    content = content.replace('MessageCircle } from "lucide-react";', 'MessageCircle, QrCode } from "lucide-react";')

# Add PixQRCodeModal import
if 'PixQRCodeModal' not in content:
    content = content.replace("import { sendWhatsAppMessage", "import { PixQRCodeModal } from '../components/financeiro/PixQRCodeModal';\nimport { sendWhatsAppMessage")

# Add state for PIX Modal
state_code = """  const [pixModalOpen, setPixModalOpen] = useState(false);
  const [pixModalData, setPixModalData] = useState<{ amount: number; txid: string; }>({ amount: 0, txid: '' });
  
  const handleOpenPix = (parcela: ParcelaReceber) => {
    setPixModalData({
        amount: parcela.valor,
        txid: parcela.id.replace(/[^a-zA-Z0-9]/g, '').substring(0, 25)
    });
    setPixModalOpen(true);
  };
"""

# Insert state after handleWhatsAppCobrança
if 'const [pixModalOpen, setPixModalOpen] = useState(false);' not in content:
    find_state = '  const handleWhatsAppCobrança = async (parcela: ParcelaReceber) => {'
    content = content.replace(find_state, state_code + '\n' + find_state)

# Insert the button
find_button = """                        {/* WhatsApp Cobrança */}
                        <button
                          onClick={() => handleWhatsAppCobrança(parcela)}"""

replace_button = """                        {/* PIX QR Code */}
                        <button
                          onClick={() => handleOpenPix(parcela)}
                          title="Gerar QR Code Pix"
                          className="p-1.5 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 transition-colors"
                        >
                          <QrCode className="w-4 h-4" />
                        </button>
                        
                        {/* WhatsApp Cobrança */}
                        <button
                          onClick={() => handleWhatsAppCobrança(parcela)}"""

if 'Gerar QR Code Pix' not in content:
    content = content.replace(find_button, replace_button)

# Find where to put the modal. Bottom of the component, just before last </div> or similar
# Let's search for the end of the return statement
find_end = """    </div>
  );
};"""

# Get tenant info. We need pixKey and merchantName
# For now, if the user hasn't configured it, we can fallback to generic names or prompt the user. But we already added fields to Empresa!
# The `state.tenant` is the Empresa.
modal_code = """
      <PixQRCodeModal
        isOpen={pixModalOpen}
        onClose={() => setPixModalOpen(false)}
        pixKey={state.tenant?.chave_pix || '00000000000'}
        merchantName={state.tenant?.nome_fantasia || 'Empresa'}
        merchantCity={state.tenant?.cidade_pix || 'SAO PAULO'}
        amount={pixModalData.amount}
        txid={pixModalData.txid}
      />
    </div>
  );
};"""

if 'PixQRCodeModal\n        isOpen={pixModalOpen}' not in content:
    content = content.replace(find_end, modal_code)

with open('src/pages/ContasReceberPage.tsx', 'w') as f:
    f.write(content)

