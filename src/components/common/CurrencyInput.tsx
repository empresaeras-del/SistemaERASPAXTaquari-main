import React, { useState, useEffect } from 'react';

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: number;
  onChange: (value: number) => void;
}

export const CurrencyInput: React.FC<CurrencyInputProps> = ({ value, onChange, ...props }) => {
  const [displayValue, setDisplayValue] = useState('');

  useEffect(() => {
    setDisplayValue(formatCurrency(value || 0));
  }, [value]);

  const formatCurrency = (val: number) => {
    const stringValue = val.toFixed(2).replace('.', ',');
    return `R$ ${stringValue.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
  };

  const parseCurrency = (val: string) => {
    const numericStr = val.replace(/[^0-9]/g, '');
    return Number(numericStr) / 100;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const numValue = parseCurrency(rawValue);
    setDisplayValue(formatCurrency(numValue));
    onChange(numValue);
  };

  return (
    <input
      type="text"
      value={displayValue}
      onChange={handleChange}
      {...props}
    />
  );
};
