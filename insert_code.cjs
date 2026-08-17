const fs = require('fs');

let code = fs.readFileSync('src/pages/Associados.tsx', 'utf8');
let newCode = fs.readFileSync('new-mensalidades-tab.tsx', 'utf8');

code = code.replace('export const AssociadosPage: React.FC = () => {', newCode + '\n\nexport const AssociadosPage: React.FC = () => {');

fs.writeFileSync('src/pages/Associados.tsx', code);
