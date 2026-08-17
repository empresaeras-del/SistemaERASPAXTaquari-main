import { get, set } from 'idb-keyval';

export interface MensagemTemplate {
  boasVindas: string;
  cobrança: string;
  renovacao: string;
}

const DEFAULT_TEMPLATES: MensagemTemplate = {
  boasVindas: "Olá {nome}! Seja muito bem-vindo(a) ao nosso sistema. É um prazer ter você conosco!",
  cobrança: "Olá {nome}! Tudo bem?\n\nIdentificamos em nosso sistema que a mensalidade/parcela no valor de R$ {valor} com vencimento em {vencimento} encontra-se em aberto.\n\nPor favor, caso já tenha efetuado o pagamento, desconsidere esta mensagem. Se precisar de ajuda ou da 2ª via do boleto, estamos à disposição.",
  renovacao: "Olá {nome}! Tudo bem?\n\nNotamos que o seu plano {plano} está próximo de ser renovado. Para garantir a continuidade dos seus benefícios, entre em contato conosco e saiba mais sobre as novidades para este novo ciclo!"
};

const TEMPLATES_STORE_KEY = 'whatsapp_templates_config';

export const getTemplates = async (): Promise<MensagemTemplate> => {
  try {
    const data = await get<MensagemTemplate>(TEMPLATES_STORE_KEY);
    return data || DEFAULT_TEMPLATES;
  } catch (error) {
    console.error("Erro ao buscar templates:", error);
    return DEFAULT_TEMPLATES;
  }
};

export const saveTemplates = async (templates: MensagemTemplate): Promise<void> => {
  try {
    await set(TEMPLATES_STORE_KEY, templates);
  } catch (error) {
    console.error("Erro ao salvar templates:", error);
    throw error;
  }
};
