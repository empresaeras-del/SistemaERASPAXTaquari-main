import re

filepath = 'src/pages/CredenciadosPage.tsx'
with open(filepath, 'r') as f:
    content = f.read()

# Find the first occurrence of "{/* Responsável e Contato */}"
start_idx = content.find("{/* Responsável e Contato */}")

# Find the first occurrence of "{/* Dados Bancários */}" after start_idx
end_idx = content.find("{/* Dados Bancários */}", start_idx)

if start_idx != -1 and end_idx != -1:
    block_to_replace = content[start_idx:end_idx]
    
    # We want to replace this block_to_replace if it contains duplicated Responsável e Contato
    if block_to_replace.count("{/* Responsável e Contato */}") > 1:
        # Find the last occurrence of "{/* Responsável e Contato */}" within the block
        last_start = block_to_replace.rfind("{/* Responsável e Contato */}")
        single_block = block_to_replace[last_start:]
        
        new_content = content[:start_idx] + single_block + content[end_idx:]
        with open(filepath, 'w') as f:
            f.write(new_content)
        print("Deduplicated successfully.")
    else:
        print("No duplication found.")
else:
    print("Could not find start or end markers.")
