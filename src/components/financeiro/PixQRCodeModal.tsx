import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Copy, Check } from 'lucide-react';
import { generatePixPayload } from '../../utils/pix';
import toast from 'react-hot-toast';

interface PixQRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  pixKey: string;
  merchantName: string;
  merchantCity: string;
  amount: number;
  txid?: string;
}

export const PixQRCodeModal: React.FC<PixQRCodeModalProps> = ({
  isOpen,
  onClose,
  pixKey,
  merchantName,
  merchantCity,
  amount,
  txid
}) => {
  const [copied, setCopied] = useState(false);
  const [payload, setPayload] = useState('');

  useEffect(() => {
    if (isOpen && pixKey) {
      const generated = generatePixPayload(pixKey, merchantName, merchantCity || 'SAO PAULO', amount, txid || '***');
      setPayload(generated);
      setCopied(false);
    }
  }, [isOpen, pixKey, merchantName, merchantCity, amount, txid]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(payload);
    setCopied(true);
    toast.success('Código Pix copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-bg-surface w-full max-w-sm rounded-3xl shadow-2xl border border-border-default overflow-hidden flex flex-col">
        <div className="p-4 border-b border-border-default flex items-center justify-between">
          <h3 className="text-lg font-bold text-text-base">Pagamento via Pix</h3>
          <button
            onClick={onClose}
            className="p-2 text-text-subtle hover:bg-bg-subtle rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 flex flex-col items-center gap-6">
          <div className="bg-white p-4 rounded-xl">
            {payload && (
              <QRCodeSVG value={payload} size={200} level="M" />
            )}
          </div>
          
          <div className="text-center space-y-1">
            <p className="text-sm text-text-subtle">Valor a pagar</p>
            <p className="text-2xl font-bold text-emerald-500">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount)}
            </p>
          </div>
          
          <div className="w-full">
            <p className="text-sm font-semibold text-text-base mb-2">Pix Copia e Cola</p>
            <div className="flex gap-2">
              <input 
                type="text" 
                readOnly 
                value={payload}
                className="flex-1 bg-bg-subtle border border-border-default rounded-xl px-3 py-2 text-xs text-text-subtle font-mono truncate"
              />
              <button 
                onClick={handleCopy}
                className="flex items-center justify-center w-10 h-10 shrink-0 bg-emerald-500/10 text-emerald-500 rounded-xl hover:bg-emerald-500/20 transition-colors"
              >
                {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
