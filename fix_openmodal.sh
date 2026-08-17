cat << 'INNER_EOF' > /tmp/openmodal.tsx
  const handleOpenModal = (atd?: Atendimento) => {
    if (atd) {
      setEditingAtendimento({ ...atd });
    } else {
      setEditingAtendimento({
        id: Math.floor(1000 + Math.random() * 9000).toString(),
        status: 'aberto',
        data: new Date().toISOString().split('T')[0],
        responsavel: state.user?.nome || 'Admin'
      });
    }
    setIsModalOpen(true);
  };
INNER_EOF
sed -i '40,51d' src/pages/Atendimentos.tsx
sed -i '39r /tmp/openmodal.tsx' src/pages/Atendimentos.tsx
