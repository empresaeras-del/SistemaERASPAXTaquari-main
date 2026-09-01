import { getTemplates } from '../services/templatesService';

export const sendWhatsAppMessage = (phone: string, text: string) => {
  if (!phone) return false;
  let cleanPhone = phone.replace(/\D/g, '');
  
  if (cleanPhone.startsWith('55') && (cleanPhone.length === 12 || cleanPhone.length === 13)) {
    // Já contém DDI 55 do Brasil
  } else if (cleanPhone.length >= 10 && cleanPhone.length <= 11) {
    cleanPhone = `55${cleanPhone}`;
  } else if (cleanPhone.length < 10) {
    return false;
  }
  
  const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
  return true;
};

export const generateCobrançaTemplate = async (
  nome: string, 
  valor: number, 
  vencimento: string,
  extra?: { empresa?: string; descricao?: string }
) => {
  const templates = await getTemplates();
  let text = templates.cobrança || '';
  const valorFormatado = Number(valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  text = text.replace(/{nome}/g, nome || '');
  text = text.replace(/{valor}/g, valorFormatado);
  text = text.replace(/{vencimento}/g, vencimento || '');
  if (extra?.empresa) text = text.replace(/{empresa}/g, extra.empresa);
  if (extra?.descricao) text = text.replace(/{descricao}/g, extra.descricao);
  return text;
};

export const generateRenovacaoTemplate = async (nome: string, plano: string) => {
  const templates = await getTemplates();
  let text = templates.renovacao || '';
  text = text.replace(/{nome}/g, nome || '');
  text = text.replace(/{plano}/g, plano ? `(${plano})` : '');
  return text;
};

export const generateBoasVindasTemplate = async (nome: string) => {
  const templates = await getTemplates();
  let text = templates.boasVindas || '';
  text = text.replace(/{nome}/g, nome || '');
  return text;
};

