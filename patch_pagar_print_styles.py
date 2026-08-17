import re

with open('src/pages/ContasPagarPage.tsx', 'r') as f:
    content = f.read()

# 1. Page Header wrapper
content = content.replace(
    '<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">',
    '<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 print:hidden">'
)

# 2. KPI Cards
content = content.replace(
    '<div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">',
    '<div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 print:hidden">'
)

# 3. Main table area
content = content.replace(
    '<div className="bg-bg-subtle border border-border-default rounded-2xl flex-1 flex flex-col overflow-hidden">',
    '<div className="bg-bg-subtle border border-border-default rounded-2xl flex-1 flex flex-col overflow-hidden print:hidden">'
)

# 4. Modal overlay
content = content.replace(
    '<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">',
    '<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm print:static print:bg-transparent print:p-0 print:block">'
)

# 5. Modal Container
content = content.replace(
    '<div className="bg-bg-subtle border border-border-default rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">',
    '<div className="bg-bg-subtle border border-border-default rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] print:max-w-none print:max-h-none print:border-none print:shadow-none print:rounded-none print:bg-transparent">'
)

# 6. Modal Header
content = content.replace(
    '<div className="flex items-center justify-between p-6 border-b border-border-default bg-bg-surface/50">',
    '<div className="flex items-center justify-between p-6 border-b border-border-default bg-bg-surface/50 print:hidden">'
)

# 7. Modal Body
content = content.replace(
    '<div className="p-6 overflow-y-auto space-y-6 flex-1">',
    '<div className="p-6 overflow-y-auto space-y-6 flex-1 print:hidden">'
)

# 8. Modal Footer
content = content.replace(
    '<div className="p-6 border-t border-border-default bg-bg-surface/50 flex flex-wrap items-center justify-between gap-3">',
    '<div className="p-6 border-t border-border-default bg-bg-surface/50 flex flex-wrap items-center justify-between gap-3 print:hidden">'
)

with open('src/pages/ContasPagarPage.tsx', 'w') as f:
    f.write(content)

