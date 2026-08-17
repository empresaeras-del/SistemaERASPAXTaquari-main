import re

with open('src/pages/Associados.tsx', 'r') as f:
    content = f.read()

# Remove double `{isVisible...` and `}}`
# From:
# isVisible('nome') && <th className="px-6 py-3 text-xs font-semibold text-text-subtle uppercase tracking-wider">Nome</th>>}
# To:
# {isVisible('nome') && <th className="px-6 py-3 text-xs font-semibold text-text-subtle uppercase tracking-wider">Nome</th>}

content = re.sub(r"isVisible\('([^']+)'\) && (<[^>]+>[^<]+</[^>]+>)>\}", r"{isVisible('\1') && \2}", content)

# td fixes
content = re.sub(r"isVisible\('([^']+)'\) && (<td[^>]*>[\s\S]*?</td>)>\}", r"{isVisible('\1') && \2}", content)

# Also fix the previous sed damage
content = content.replace(">} }", "}")

with open('src/pages/Associados.tsx', 'w') as f:
    f.write(content)
