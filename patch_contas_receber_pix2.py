import re

with open('src/pages/ContasReceberPage.tsx', 'r') as f:
    content = f.read()

find_modal = """      <PixQRCodeModal
        isOpen={pixModalOpen}
        onClose={() => setPixModalOpen(false)}
        pixKey={state.tenant?.chave_pix || '00000000000'}
        merchantName={state.tenant?.nome_fantasia || 'Empresa'}
        merchantCity={state.tenant?.cidade_pix || 'SAO PAULO'}"""

replace_modal = """      <PixQRCodeModal
        isOpen={pixModalOpen}
        onClose={() => setPixModalOpen(false)}
        pixKey={'00000000000'}
        merchantName={'Empresa'}
        merchantCity={'SAO PAULO'}"""

content = content.replace(find_modal, replace_modal)

with open('src/pages/ContasReceberPage.tsx', 'w') as f:
    f.write(content)
