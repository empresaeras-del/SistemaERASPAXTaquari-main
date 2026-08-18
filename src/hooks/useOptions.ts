import { useState, useEffect } from 'react';
import { getFromIDB, saveToIDB } from '../lib/idb';

export const useOptions = (key: string, defaultOptions: string[]) => {
  const [options, setOptions] = useState<string[]>(defaultOptions);
  
  useEffect(() => {
    const loadOptions = async () => {
      try {
        const data = await getFromIDB<{id: string, options: string[]}>('preferencias', key);
        if (data && Array.isArray(data.options) && data.options.length > 0) {
          // Garante que todas as defaultOptions também existam sem duplicar
          const merged = Array.from(new Set([...data.options, ...defaultOptions]));
          setOptions(merged);
        } else {
          setOptions(defaultOptions);
          await saveToIDB('preferencias', { id: key, options: defaultOptions });
        }
      } catch (e) {
        console.warn('Erro ao carregar opções de preferências:', e);
        setOptions(defaultOptions);
      }
    };
    loadOptions();
  }, [key]);
  
  const addOption = async (option: string) => {
    const trimmed = option.trim();
    if (!trimmed) return;
    if (!options.includes(trimmed)) {
      const newOptions = [...options, trimmed];
      setOptions(newOptions);
      await saveToIDB('preferencias', { id: key, options: newOptions });
    }
  };

  const editOption = async (oldOption: string, newOption: string) => {
    const trimmed = newOption.trim();
    if (!trimmed) return;
    const newOptions = options.map(o => (o === oldOption ? trimmed : o));
    setOptions(newOptions);
    await saveToIDB('preferencias', { id: key, options: newOptions });
  };
  
  const removeOption = async (option: string) => {
    const newOptions = options.filter(o => o !== option);
    setOptions(newOptions);
    await saveToIDB('preferencias', { id: key, options: newOptions });
  };
  
  return { options, addOption, editOption, removeOption };
};
