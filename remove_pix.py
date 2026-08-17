import re

with open('src/pages/ContasReceberPage.tsx', 'r') as f:
    content = f.read()

# 1. Remove PixQRCodeModal import
content = re.sub(r"import \{ PixQRCodeModal \} from '\.\./components/financeiro/PixQRCodeModal';\n", '', content)

# 2. Remove QrCode icon import (might be tricky if it's in a comma-separated list, I'll just remove " QrCode," or ", QrCode" or "QrCode")
content = re.sub(r", QrCode ", ' ', content)
content = re.sub(r"QrCode, ", '', content)

# 3. Remove state variables
content = re.sub(r"  const \[pixModalOpen, setPixModalOpen\] = useState\(false\);\n", '', content)
content = re.sub(r"  const \[pixModalData, setPixModalData\] = useState<\{ amount: number; txid: string; pixKey: string; merchantName: string; merchantCity: string; \}>\(\{ amount: 0, txid: '', pixKey: '', merchantName: '', merchantCity: '' \}\);\n", '', content)

# 4. Remove handleOpenPix function
# It starts at `const handleOpenPix = async (parcela: ParcelaReceber) => {`
# and ends at `setPixModalOpen(true);\n  };`
pattern = re.compile(r"  const handleOpenPix = async \(parcela: ParcelaReceber\) => \{.*?setPixModalOpen\(true\);\n  \};\n", re.DOTALL)
content = pattern.sub('', content)

# 5. Remove PIX QR Code button in the table
pattern2 = re.compile(r"                        \{\/\* PIX QR Code \*\/.*?<\/button>\n", re.DOTALL)
content = pattern2.sub('', content)

# 6. Remove <PixQRCodeModal /> component usage at the bottom
pattern3 = re.compile(r"      <PixQRCodeModal.*?/>\n", re.DOTALL)
content = pattern3.sub('', content)

with open('src/pages/ContasReceberPage.tsx', 'w') as f:
    f.write(content)

