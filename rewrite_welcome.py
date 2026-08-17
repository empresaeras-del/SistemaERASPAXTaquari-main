import sys

with open('src/components/layout/WelcomeModal.tsx', 'r') as f:
    content = f.read()

# I want to add an event listener.
# The easiest way is to add a new useEffect.
# But loadData is inside the first useEffect. Let's just create a duplicate fetch or move it.
# Actually, I can just replace the useEffect completely.

new_use_effect = """
  const loadData = async () => {
    if (!state.empresaSelecionada || !state.user) return;
    setLoading(true);
    try {
      const lote = await getLoteAbertoAtivo(state.isOnline, state.empresaSelecionada);
      setCaixaStatus(lote);
      
      const parcelasReceber = await getParcelasReceber(state.isOnline, state.empresaSelecionada);
      const parcelasPagar = await getParcelasPagar(state.isOnline, state.empresaSelecionada);
      
      const hojeReceber = parcelasReceber.filter(p => p.status === 'pendente' && p.data_vencimento && isToday(new Date(p.data_vencimento + 'T12:00:00')));
      const hojePagar = parcelasPagar.filter(p => p.status === 'pendente' && p.data_vencimento && isToday(new Date(p.data_vencimento + 'T12:00:00')));
      
      setReceberHoje(hojeReceber);
      setPagarHoje(hojePagar);
    } catch (error) {
      console.error("Erro ao carregar dados do welcome modal:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const hasSeen = sessionStorage.getItem('has_seen_welcome_modal');
    if (!hasSeen && state.empresaSelecionada && state.user) {
      loadData().then(() => {
        setIsOpen(true);
        sessionStorage.setItem('has_seen_welcome_modal', 'true');
      });
    }
  }, [state.empresaSelecionada, state.isOnline, state.user]);

  useEffect(() => {
    const handleOpen = () => {
      loadData().then(() => setIsOpen(true));
    };
    window.addEventListener('open-welcome-modal', handleOpen);
    return () => window.removeEventListener('open-welcome-modal', handleOpen);
  }, [state.empresaSelecionada, state.isOnline, state.user]);
"""

import re
content = re.sub(r'useEffect\(\(\) => \{\n\s*// Only show once per session.*?loadData\(\);\n\s*\}, \[state\.empresaSelecionada, state\.isOnline, state\.user\]\);', new_use_effect, content, flags=re.DOTALL)

with open('src/components/layout/WelcomeModal.tsx', 'w') as f:
    f.write(content)

