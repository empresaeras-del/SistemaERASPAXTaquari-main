cat << 'INNER_EOF' > /tmp/hd.tsx
  const handleDelete = (id: string) => {
    confirm({
      title: "Excluir Associado",
      message: "Tem certeza que deseja excluir este associado? Esta ação moverá o registro para a lixeira.",
      danger: true,
      confirmText: "Excluir",
      onConfirm: async () => {
        try {
          await softDeleteAssociado(id, state.isOnline);
          setAssociados(current => current.filter(a => a.id !== id));
          toast.success("Associado excluído com sucesso!");
        } catch (error) {
          console.error("Erro ao excluir", error);
          toast.error("Erro ao excluir associado. Verifique se você está online.");
        }
      }
    });
  };
INNER_EOF
sed -i '100,116d' src/pages/Associados.tsx
sed -i '99r /tmp/hd.tsx' src/pages/Associados.tsx
