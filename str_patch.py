with open('src/services/caixasService.ts', 'r') as f:
    content = f.read()

target = """  await saveToIDB('lotes_caixa', loteAtualizado);

  if (isOnline) {
    try {
      const { error } = await supabase.from('lotes_caixa').upsert(loteAtualizado);
      if (error) throw new Error(error.message);
    } catch (e) {
      await addToSyncQueue({ storeName: 'lotes_caixa', action: 'upsert', data: loteAtualizado as any });
    }
  }"""

repl = """  if (isOnline) {
    const { error } = await supabase.from('lotes_caixa').upsert(loteAtualizado);
    if (error) {
      console.error('Supabase update lote error:', error);
      throw new Error("Erro do banco de dados ao atualizar lote: " + error.message);
    }
  } else {
    await addToSyncQueue({ storeName: 'lotes_caixa', action: 'upsert', data: loteAtualizado as any });
  }

  await saveToIDB('lotes_caixa', loteAtualizado);"""

if target in content:
    content = content.replace(target, repl)
    with open('src/services/caixasService.ts', 'w') as f:
        f.write(content)
    print("Replaced!")
else:
    print("Not found!")
