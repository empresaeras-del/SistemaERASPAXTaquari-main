import { Associado } from '../services/associadosService';
import { isValidCPFOrCNPJ } from './validators';

export type AssociadoSubTab = 'basicas' | 'filiacao' | 'contato' | 'endereco' | 'sistema';

export interface ErroValidacaoAssociado {
  campo: string;
  label: string;
  subTab: AssociadoSubTab;
  mensagem: string;
}

export interface ResultadoValidacaoAssociado {
  valido: boolean;
  erros: ErroValidacaoAssociado[];
}

/**
 * Valida os campos obrigatórios de um associado para salvamento.
 * Extraída de pages/Associados.tsx (mesma lógica, comportamento idêntico) para
 * poder ser testada isoladamente — ver CLAUDE.md sobre god components.
 */
export const validarDadosAssociado = (assoc: Associado | null): ResultadoValidacaoAssociado => {
  if (!assoc) return { valido: false, erros: [] };

  const erros: ErroValidacaoAssociado[] = [];

  // Informações Básicas
  if (!assoc.nome || !assoc.nome.trim()) {
    erros.push({
      campo: 'nome',
      label: 'Nome Completo',
      subTab: 'basicas',
      mensagem: 'Nome completo é obrigatório.'
    });
  }

  const cpfLimpo = (assoc.cpf || '').replace(/\D/g, '');
  if (!assoc.cpf || !assoc.cpf.trim() || cpfLimpo.length === 0) {
    erros.push({
      campo: 'cpf',
      label: 'CPF',
      subTab: 'basicas',
      mensagem: 'CPF é obrigatório.'
    });
  } else if (!isValidCPFOrCNPJ(assoc.cpf, false)) {
    erros.push({
      campo: 'cpf',
      label: 'CPF',
      subTab: 'basicas',
      mensagem: 'CPF inválido.'
    });
  }

  if (!assoc.data_nascimento || !assoc.data_nascimento.trim()) {
    erros.push({
      campo: 'data_nascimento',
      label: 'Data de Nascimento',
      subTab: 'basicas',
      mensagem: 'Data de nascimento é obrigatória.'
    });
  }

  if (!assoc.sexo || !assoc.sexo.trim()) {
    erros.push({
      campo: 'sexo',
      label: 'Sexo',
      subTab: 'basicas',
      mensagem: 'Selecione o sexo.'
    });
  }

  // Contato
  const telLimpo = (assoc.telefone || '').replace(/\D/g, '');
  if (!assoc.telefone || !assoc.telefone.trim() || telLimpo.length < 10) {
    erros.push({
      campo: 'telefone',
      label: 'Telefone',
      subTab: 'contato',
      mensagem: 'Telefone com DDD é obrigatório.'
    });
  }

  // Endereço
  const cep = ((assoc.endereco_cep || assoc.cep || '') + '').trim();
  if (!cep) {
    erros.push({
      campo: 'endereco_cep',
      label: 'CEP',
      subTab: 'endereco',
      mensagem: 'CEP é obrigatório.'
    });
  }

  const logradouro = ((assoc.endereco_logradouro || assoc.logradouro || '') + '').trim();
  if (!logradouro) {
    erros.push({
      campo: 'endereco_logradouro',
      label: 'Logradouro',
      subTab: 'endereco',
      mensagem: 'Logradouro é obrigatório.'
    });
  }

  const numero = ((assoc.endereco_numero || assoc.numero || '') + '').trim();
  if (!numero) {
    erros.push({
      campo: 'endereco_numero',
      label: 'Número',
      subTab: 'endereco',
      mensagem: 'Número é obrigatório.'
    });
  }

  const bairro = ((assoc.endereco_bairro || assoc.bairro || '') + '').trim();
  if (!bairro) {
    erros.push({
      campo: 'endereco_bairro',
      label: 'Bairro',
      subTab: 'endereco',
      mensagem: 'Bairro é obrigatório.'
    });
  }

  const cidade = ((assoc.endereco_cidade || assoc.cidade || assoc.municipio || '') + '').trim();
  if (!cidade) {
    erros.push({
      campo: 'endereco_cidade',
      label: 'Município / UF',
      subTab: 'endereco',
      mensagem: 'Município / UF é obrigatório.'
    });
  }

  // Sistema
  if (!assoc.data_adesao || !assoc.data_adesao.trim()) {
    erros.push({
      campo: 'data_adesao',
      label: 'Data de Adesão',
      subTab: 'sistema',
      mensagem: 'Data de adesão é obrigatória.'
    });
  }

  return {
    valido: erros.length === 0,
    erros
  };
};
