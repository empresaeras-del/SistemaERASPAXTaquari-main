sed -i '24,28d' src/pages/Atendimentos.tsx
cat << 'INNER_EOF' > /tmp/atend_filtered.tsx
  const filtered = atendimentos.filter(a => {
    const matchesSearch = a.titular.toLowerCase().includes(searchTerm.toLowerCase()) || a.falecido.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter ? a.status === statusFilter : true;
    return matchesSearch && matchesStatus;
  });
INNER_EOF
sed -i '30r /tmp/atend_filtered.tsx' src/pages/Atendimentos.tsx
