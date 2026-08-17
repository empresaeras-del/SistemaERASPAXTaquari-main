import re

with open('src/index.css', 'r') as f:
    content = f.read()

# Find everything between @media print { ... }
media_print_match = re.search(r'@media print \{(.*?)\}\n@layer', content, re.DOTALL)
if media_print_match:
    media_print_content = media_print_match.group(1)
    
    # We want to replace body, html { ... } with .print-preview-mode { ... }
    # and all other selectors with .print-preview-mode selector
    
    # Simple regex to prefix selectors inside media print
    # This might be complex, let's just write the specific preview CSS manually
