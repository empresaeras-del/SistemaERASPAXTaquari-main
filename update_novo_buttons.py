import os
import re

standard_class = "flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary to-blue-400 text-white rounded-xl text-sm font-bold hover:opacity-90 transition-opacity shadow-lg shadow-primary/25"

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # Strategy: find all instances of `<button ... Novo [Word] ... </button>` and update their className.
    # It might span multiple lines
    new_content = re.sub(
        r'(<button[^>]*?className=")([^"]+)("[^>]*?>\s*(?:<[^>]+>\s*)*Novo [a-zA-ZÀ-ÿ]+\s*(?:</[^>]+>\s*)*</button>)',
        lambda m: m.group(1) + standard_class + m.group(3),
        content,
        flags=re.IGNORECASE | re.DOTALL
    )
    
    # Check if there are other cases where the class name is broken down (e.g. template literals) - for now just standard
    if content != new_content:
        print(f"Updated {filepath}")
        with open(filepath, 'w') as f:
            f.write(new_content)

for root, _, files in os.walk('src/pages'):
    for file in files:
        if file.endswith('.tsx'):
            process_file(os.path.join(root, file))

