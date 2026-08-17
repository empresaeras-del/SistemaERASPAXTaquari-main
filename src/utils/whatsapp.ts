import { getTemplates } from '../services/templatesService';

export const sendWhatsAppMessage = (phone: string, text: string) => {
  if (!phone) return false;
  const cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length < 10) return false;
  
  const url = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
  return true;
};

export const generateCobrançaTemplate = async (nome: string, valor: number, vencimento: string) => {
  const templates = await getTemplates();
  let text = templates.cobrança;
  text = text.replace(/{nome}/g, nome || '');
  text = text.replace(/{valor}/g, valor.toFixed(2).replace('.', ','));
  text = text.replace(/{vencimento}/g, vencimento || '');
  return text;
};

export const generateRenovacaoTemplate = async (nome: string, plano: string) => {
  const templates = await getTemplates();
  let text = templates.renovacao;
  text = text.replace(/{nome}/g, nome || '');
  text = text.replace(/{plano}/g, plano ? `(${plano})` : '');
  return text;
};

export const generateBoasVindasTemplate = async (nome: string) => {
  const templates = await getTemplates();
  let text = templates.boasVindas;
  text = text.replace(/{nome}/g, nome || '');
  return text;
};
