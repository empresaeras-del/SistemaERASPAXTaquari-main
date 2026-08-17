import sys

with open('src/components/layout/WelcomeModal.tsx', 'r') as f:
    content = f.read()

# Add event listener for opening manually
if 'open-welcome-modal' not in content:
    content = content.replace(
        "const hasSeen = sessionStorage.getItem('has_seen_welcome_modal');",
        """
    const handleOpen = () => setIsOpen(true);
    window.addEventListener('open-welcome-modal', handleOpen);
    
    const hasSeen = sessionStorage.getItem('has_seen_welcome_modal');
"""
    )
    content = content.replace(
        "if (hasSeen || !state.empresaSelecionada || !state.user) {",
        """
    if (hasSeen || !state.empresaSelecionada || !state.user) {
"""
    )
    # also add return cleanup
    content = content.replace(
        "const loadData = async () => {",
        """
    const loadData = async () => {
"""
    )

with open('src/components/layout/WelcomeModal.tsx', 'w') as f:
    f.write(content)

