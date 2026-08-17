import { useState, useEffect } from 'react';
import { getFromIDB, saveToIDB } from '../lib/idb';

export const useOptions = (key: string, defaultOptions: string[]) => {
  const [options, setOptions] = useState<string[]>(defaultOptions);
  
  useEffect(() => {
    const loadOptions = async () => {
      const data = await getFromIDB<{id: string, options: string[]}>('preferencias', key);
      if (data && data.options) {
        setOptions(data.options);
      } else {
        await saveToIDB('preferencias', { id: key, options: defaultOptions });
      }
    };
    loadOptions();
  }, [key]); // defaultOptions shouldn't be a dependency or we use JSON.stringify
  
  const addOption = async (option: string) => {
    if (!options.includes(option)) {
      const newOptions = [...options, option];
      setOptions(newOptions);
      await saveToIDB('preferencias', { id: key, options: newOptions });
    }
  };
  
  const removeOption = async (option: string) => {
    const newOptions = options.filter(o => o !== option);
    setOptions(newOptions);
    await saveToIDB('preferencias', { id: key, options: newOptions });
  };
  
  return { options, addOption, removeOption };
};
