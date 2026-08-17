import sys

with open('src/components/layout/WelcomeModal.tsx', 'r') as f:
    content = f.read()

# Find the start of useEffect
import re
match = re.search(r'useEffect\(\(\) => \{([\s\S]*?)\}, \[\]\);', content)

# I can just insert another useEffect for the listener
insert_code = """
  useEffect(() => {
    const handleOpen = () => {
      setIsOpen(true);
      loadData(); // Need to make sure it loads data when opened manually
    };
    window.addEventListener('open-welcome-modal', handleOpen);
    return () => window.removeEventListener('open-welcome-modal', handleOpen);
  }, [state.empresaSelecionada, state.isOnline, state.user]);
"""

# Let's see the structure
