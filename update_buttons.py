import os
import re

standard_class = "flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary to-blue-400 text-white rounded-xl text-sm font-bold hover:opacity-90 transition-opacity shadow-lg shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed"

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # Find button chunks
    matches = re.finditer(r'<button\b(.*?)</button>', content, re.IGNORECASE | re.DOTALL)
    
    new_content = content
    for m in matches:
        button_inner = m.group(1)
        # Check if button contains "Novo [Word]" (ignoring tags inside)
        inner_text = re.sub(r'<[^>]+>', '', button_inner).strip()
        if re.match(r'^Novo\s+[a-zA-ZÀ-ÿ]+$', inner_text, re.IGNORECASE) or re.match(r'^\s*Novo\s+[a-zA-ZÀ-ÿ]+\s*$', inner_text, re.IGNORECASE):
            # Replace className inside button_inner
            new_button_inner = re.sub(r'className="[^"]+"', f'className="{standard_class}"', button_inner)
            if new_button_inner != button_inner:
                new_content = new_content.replace(m.group(0), f'<button{new_button_inner}</button>')
                print(f"Updated {filepath} button: {inner_text}")

    if content != new_content:
        with open(filepath, 'w') as f:
            f.write(new_content)

for root, _, files in os.walk('src/pages'):
    for file in files:
        if file.endswith('.tsx'):
            process_file(os.path.join(root, file))

