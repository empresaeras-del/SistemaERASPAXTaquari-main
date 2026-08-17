import re

with open('src/pages/ContasReceberPage.tsx', 'r') as f:
    content = f.read()

# Replace state definition
old_state = "const [pixModalData, setPixModalData] = useState<{ amount: number; txid: string; }>({ amount: 0, txid: '' });"
new_state = "const [pixModalData, setPixModalData] = useState<{ amount: number; txid: string; pixKey: string; merchantName: string; merchantCity: string; }>({ amount: 0, txid: '', pixKey: '', merchantName: '', merchantCity: '' });"
content = content.replace(old_state, new_state)

# We need to import getEmpresaById if not already imported
if "getEmpresaById" not in content:
    content = content.replace(
        "import { getLoteAbertoAtivo, registrarMovimentacao } from '../services/caixasService';",
        "import { getLoteAbertoAtivo, registrarMovimentacao } from '../services/caixasService';\nimport { getEmpresaById } from '../services/empresasService';"
    )

# Replace handleOpenPix
old_handle = """  const handleOpenPix = (parcela: ParcelaReceber) => {
    setPixModalData({
        amount: parcela.valor,
        txid: parcela.id.replace(/[^a-zA-Z0-9]/g, '').substring(0, 25)
    });
    setPixModalOpen(true);
  };"""

new_handle = """  const handleOpenPix = async (parcela: ParcelaReceber) => {
    // Procurar a conta bancária vinculada à parcela, ou a primeira que tenha chave PIX
    let conta = contasBancarias.find(c => c.id === parcela.conta_bancaria_id);
    if (!conta || !conta.chave_pix) {
      conta = contasBancarias.find(c => c.chave_pix);
    }
    
    if (!conta || !conta.chave_pix) {
      toast.error('Nenhuma Chave PIX encontrada nas Contas Bancárias.');
      return;
    }

    let merchantName = 'Empresa';
    let merchantCity = 'SAO PAULO';

    try {
      const empresa = await getEmpresaById(state.empresaSelecionada, state.isOnline);
      if (empresa) {
        merchantName = empresa.razao_social || empresa.nome_fantasia || 'Empresa';
        merchantCity = empresa.cidade_pix || 'SAO PAULO'; // Assuming we can use a fallback
      }
    } catch (e) {
      console.warn('Erro ao buscar dados da empresa para o PIX', e);
    }

    setPixModalData({
        amount: parcela.valor,
        txid: parcela.id.replace(/[^a-zA-Z0-9]/g, '').substring(0, 25),
        pixKey: conta.chave_pix,
        merchantName,
        merchantCity
    });
    setPixModalOpen(true);
  };"""

content = content.replace(old_handle, new_handle)

# Replace PixQRCodeModal usage
old_usage = """      <PixQRCodeModal
        isOpen={pixModalOpen}
        onClose={() => setPixModalOpen(false)}
        pixKey={'00000000000'}
        merchantName={'Empresa'}
        merchantCity={'SAO PAULO'}
        amount={pixModalData.amount}
        txid={pixModalData.txid}
      />"""

new_usage = """      <PixQRCodeModal
        isOpen={pixModalOpen}
        onClose={() => setPixModalOpen(false)}
        pixKey={pixModalData.pixKey}
        merchantName={pixModalData.merchantName}
        merchantCity={pixModalData.merchantCity}
        amount={pixModalData.amount}
        txid={pixModalData.txid}
      />"""

content = content.replace(old_usage, new_usage)

with open('src/pages/ContasReceberPage.tsx', 'w') as f:
    f.write(content)
