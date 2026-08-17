import os
import re

for file in os.listdir('src/pages'):
    if file.endswith('.tsx'):
        with open(f'src/pages/{file}', 'r') as f:
            content = f.read()
            matches = re.finditer(r'<button\b(.*?)</button>', content, re.IGNORECASE | re.DOTALL)
            for m in matches:
                inner_text = re.sub(r'<[^>]+>', '', m.group(1)).strip()
                if "Novo" in inner_text:
                    print(f"{file}: {repr(inner_text)}")
