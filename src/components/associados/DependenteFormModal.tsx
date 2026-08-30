import React, { useState, useEffect } from 'react';
import { 
  X, 
  User, 
  Users, 
  Calendar, 
  CreditCard, 
  Phone, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  HeartHandshake,
  Sparkles,
  ShieldAlert
} from 'lucide-react';
import { Dependente } from '../../services/associadosService';
import { isValidCPFOrCNPJ, maskCPFOrCNPJ } from '../../utils/validators';
import { differenceInYears, parseISO, isValid } from 'date-fns';
import toast from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';

export interface DependenteFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  dependente?: Dependente | null;
  onSave: (dep: Dependente) => void;
  titularNome?: string;
  existingCpfs?: string[];
}

const OPCOES_PARENTESCO = [
  'Cônjuge / Esposo(a)',
  'Filho(a)',
  'Enteado(a)',
  'Pai / Mãe',
  'Sogro(a)',
  'Irmão(ã)',
  'Neto(a)',
  'Avô / Avó',
  'Tio(a)',
  'Sobrinho(a)',
  'Genro / Nora',
  'Outro'
];

export const DependenteFormModal: React.FC<DependenteFormModalProps> = ({
  isOpen,
  onClose,
  dependente,
  onSave,
  titularNome,
  existingCpfs = []
}) => {
  const [nome, setNome] = useState('');
  const [parentesco, setParentesco] = useState('');
  const [parentescoPersonalizado, setParentescoPersonalizado] = useState('');
  const [cpf, setCpf] = useState('');
  const [rg, setRg] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [sexo, setSexo] = useState<string>('nao_informado');
  const [telefone, setTelefone] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Preenche dados quando abre para edição ou reseta para novo
  useEffect(() => {
    if (!isOpen) return;

    if (dependente) {
      setNome(dependente.nome || '');
      
      const parentescoExiste = OPCOES_PARENTESCO.includes(dependente.parentesco || '');
      if (parentescoExiste) {
        setParentesco(dependente.parentesco || '');
        setParentescoPersonalizado('');
      } else if (dependente.parentesco) {
        setParentesco('Outro');
        setParentescoPersonalizado(dependente.parentesco);
      } else {
        setParentesco('');
        setParentescoPersonalizado('');
      }

      setCpf(dependente.cpf ? maskCPFOrCNPJ(dependente.cpf, false) : '');
      setRg((dependente as any).rg || '');
      setDataNascimento(dependente.data_nascimento || '');
      setSexo((dependente as any).sexo || 'nao_informado');
      setTelefone((dependente as any).telefone || '');
      setObservacoes((dependente as any).observacoes || '');
    } else {
      setNome('');
      setParentesco('');
      setParentescoPersonalizado('');
      setCpf('');
      setRg('');
      setDataNascimento('');
      setSexo('nao_informado');
      setTelefone('');
      setObservacoes('');
    }
    setErrors({});
  }, [isOpen, dependente]);

  // Tecla ESC para fechar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Cálculo da idade em tempo real
  const idadeCalculada = React.useMemo(() => {
    if (!dataNascimento) return null;
    try {
      const date = parseISO(dataNascimento);
      if (isValid(date)) {
        const anos = differenceInYears(new Date(), date);
        return anos >= 0 ? anos : null;
      }
    } catch (e) {
      return null;
    }
    return null;
  }, [dataNascimento]);

  // Validação do CPF em tempo real
  const cpfValidationState = React.useMemo(() => {
    const cleanCpf = cpf.replace(/\D/g, '');
    if (!cleanCpf) return 'empty';
    if (cleanCpf.length < 11) return 'incomplete';
    if (!isValidCPFOrCNPJ(cpf, false)) return 'invalid';

    // Checa duplicidade com outros dependentes
    const isDuplicate = existingCpfs.some(existing => {
      const cleanExisting = existing.replace(/\D/g, '');
      const isSelf = dependente?.cpf && dependente.cpf.replace(/\D/g, '') === cleanExisting;
      return !isSelf && cleanExisting === cleanCpf;
    });

    if (isDuplicate) return 'duplicate';
    return 'valid';
  }, [cpf, existingCpfs, dependente]);

  // Formatação de telefone
  const handleTelefoneChange = (val: string) => {
    const numbers = val.replace(/\D/g, '').slice(0, 11);
    if (numbers.length <= 2) {
      setTelefone(numbers.length > 0 ? `(${numbers}` : '');
    } else if (numbers.length <= 6) {
      setTelefone(`(${numbers.slice(0, 2)}) ${numbers.slice(2)}`);
    } else if (numbers.length <= 10) {
      setTelefone(`(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`);
    } else {
      setTelefone(`(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`);
    }
  };

  const handleSalvar = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!nome.trim() || nome.trim().length < 3) {
      newErrors.nome = 'Informe o nome completo do dependente (mínimo 3 caracteres)';
    }

    const parentescoFinal = parentesco === 'Outro' ? parentescoPersonalizado.trim() : parentesco;
    if (!parentescoFinal) {
      newErrors.parentesco = 'Selecione ou informe o grau de parentesco';
    }

    if (cpf.trim()) {
      if (cpfValidationState === 'invalid') {
        newErrors.cpf = 'CPF inválido. Verifique os números digitados.';
      } else if (cpfValidationState === 'duplicate') {
        newErrors.cpf = 'Este CPF já está cadastrado em outro dependente deste associado.';
      }
    }

    if (dataNascimento) {
      const date = parseISO(dataNascimento);
      if (!isValid(date) || date > new Date()) {
        newErrors.dataNascimento = 'Data de nascimento inválida ou futura.';
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      const firstError = Object.values(newErrors)[0];
      toast.error(firstError);
      return;
    }

    const depData: Dependente = {
      id: dependente?.id || uuidv4(),
      nome: nome.trim().toUpperCase(),
      parentesco: parentescoFinal.toUpperCase(),
      cpf: cpf.trim() || undefined,
      data_nascimento: dataNascimento || undefined,
      rg: rg.trim() || undefined,
      sexo: sexo !== 'nao_informado' ? sexo : undefined,
      telefone: telefone.trim() || undefined,
      observacoes: observacoes.trim() || undefined
    } as Dependente;

    onSave(depData);
    toast.success(dependente ? 'Dependente atualizado com sucesso!' : 'Dependente cadastrado com sucesso!');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#181d27] border border-[#2d3544] w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Cabeçalho do Modal */}
        <div className="p-5 sm:p-6 border-b border-[#2d3544] flex items-center justify-between bg-[#13171f]">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0 shadow-inner">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white leading-tight">
                  {dependente ? 'Editar Dependente' : 'Novo Dependente'}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {dependente ? 'Modo Edição' : 'Novo Cadastro'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {titularNome ? `Associado Titular: ${titularNome}` : 'Cadastre as informações completas do dependente'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-[#232936] rounded-xl transition-colors"
            title="Fechar (ESC)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulário com Scroll */}
        <form onSubmit={handleSalvar} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 custom-scrollbar text-white">
          
          {/* Card Informativo de Vínculo Contratual */}
          <div className="p-4 bg-gradient-to-r from-blue-900/30 to-indigo-900/20 border border-blue-500/30 rounded-2xl flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-200 leading-relaxed">
              <span className="font-bold text-white">Regra de Contrato: </span>
              A inclusão ou alteração de dependentes é refletida no cálculo de mensalidades do plano contratado e fica disponível para emissão automática de Termos Aditivos e Requisições.
            </div>
          </div>

          {/* SEÇÃO 1: DADOS PRINCIPAIS */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              Identificação do Dependente
            </h4>

            {/* Nome Completo */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                Nome Completo <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => {
                    setNome(e.target.value.toUpperCase());
                    if (errors.nome) setErrors(prev => ({ ...prev, nome: '' }));
                  }}
                  placeholder="Nome completo do dependente..."
                  autoFocus
                  className={`w-full bg-[#13171f] border rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none transition-colors ${
                    errors.nome ? 'border-rose-500 focus:border-rose-500' : 'border-[#2d3544] focus:border-blue-500'
                  }`}
                />
              </div>
              {errors.nome && <p className="text-[11px] text-rose-400 font-medium">{errors.nome}</p>}
            </div>

            {/* Grau de Parentesco */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Grau de Parentesco <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <select
                    value={parentesco}
                    onChange={(e) => {
                      setParentesco(e.target.value);
                      if (errors.parentesco) setErrors(prev => ({ ...prev, parentesco: '' }));
                    }}
                    className={`w-full bg-[#13171f] border rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none transition-colors ${
                      errors.parentesco ? 'border-rose-500 focus:border-rose-500' : 'border-[#2d3544] focus:border-blue-500'
                    }`}
                  >
                    <option value="">Selecione o parentesco...</option>
                    {OPCOES_PARENTESCO.map(op => (
                      <option key={op} value={op}>{op}</option>
                    ))}
                  </select>
                </div>
                {errors.parentesco && <p className="text-[11px] text-rose-400 font-medium">{errors.parentesco}</p>}
              </div>

              {/* Se for 'Outro', exibe campo para digitação */}
              {parentesco === 'Outro' ? (
                <div className="space-y-1.5 animate-in fade-in duration-150">
                  <label className="block text-xs font-semibold text-slate-300">
                    Especifique o Parentesco <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={parentescoPersonalizado}
                    onChange={(e) => setParentescoPersonalizado(e.target.value.toUpperCase())}
                    placeholder="Ex: Padrasto, Afilhado..."
                    className="w-full bg-[#13171f] border border-[#2d3544] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    Sexo / Gênero
                  </label>
                  <select
                    value={sexo}
                    onChange={(e) => setSexo(e.target.value)}
                    className="w-full bg-[#13171f] border border-[#2d3544] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="nao_informado">Não informado</option>
                    <option value="masculino">Masculino</option>
                    <option value="feminino">Feminino</option>
                  </select>
                </div>
              )}
            </div>

            {/* CPF e Data de Nascimento */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* CPF com feedback */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-300">
                    CPF (Opcional)
                  </label>
                  {cpfValidationState === 'valid' && (
                    <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> CPF Válido
                    </span>
                  )}
                  {cpfValidationState === 'invalid' && (
                    <span className="text-[10px] text-rose-400 font-bold flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> CPF Inválido
                    </span>
                  )}
                  {cpfValidationState === 'duplicate' && (
                    <span className="text-[10px] text-amber-400 font-bold flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3" /> CPF Já Vinculado
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  maxLength={14}
                  value={cpf}
                  onChange={(e) => {
                    const masked = maskCPFOrCNPJ(e.target.value, false);
                    setCpf(masked);
                    if (errors.cpf) setErrors(prev => ({ ...prev, cpf: '' }));
                  }}
                  placeholder="000.000.000-00"
                  className={`w-full bg-[#13171f] border rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none transition-colors ${
                    errors.cpf 
                      ? 'border-rose-500 focus:border-rose-500' 
                      : cpfValidationState === 'valid' 
                      ? 'border-emerald-500/50 focus:border-emerald-500' 
                      : 'border-[#2d3544] focus:border-blue-500'
                  }`}
                />
                {errors.cpf && <p className="text-[11px] text-rose-400 font-medium">{errors.cpf}</p>}
              </div>

              {/* Data de Nascimento com cálculo de idade */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-300">
                    Data de Nascimento
                  </label>
                  {idadeCalculada !== null && (
                    <span className="text-[10px] text-blue-400 font-bold px-1.5 py-0.2 bg-blue-500/10 rounded border border-blue-500/20">
                      {idadeCalculada} {idadeCalculada === 1 ? 'ano' : 'anos'}
                    </span>
                  )}
                </div>
                <input
                  type="date"
                  value={dataNascimento}
                  onChange={(e) => {
                    setDataNascimento(e.target.value);
                    if (errors.dataNascimento) setErrors(prev => ({ ...prev, dataNascimento: '' }));
                  }}
                  className={`w-full bg-[#13171f] border rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none transition-colors ${
                    errors.dataNascimento ? 'border-rose-500 focus:border-rose-500' : 'border-[#2d3544] focus:border-blue-500'
                  }`}
                />
                {errors.dataNascimento && <p className="text-[11px] text-rose-400 font-medium">{errors.dataNascimento}</p>}
              </div>
            </div>

            {/* RG e Telefone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  RG (Registro Geral)
                </label>
                <input
                  type="text"
                  value={rg}
                  onChange={(e) => setRg(e.target.value.toUpperCase())}
                  placeholder="Número do RG..."
                  className="w-full bg-[#13171f] border border-[#2d3544] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Telefone / Celular (WhatsApp)
                </label>
                <input
                  type="text"
                  value={telefone}
                  onChange={(e) => handleTelefoneChange(e.target.value)}
                  placeholder="(00) 00000-0000"
                  className="w-full bg-[#13171f] border border-[#2d3544] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Observações / Restrições */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                Observações / Informações Médicas (Opcional)
              </label>
              <textarea
                rows={2}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Anotações internas, restrições ou observações adicionais..."
                className="w-full bg-[#13171f] border border-[#2d3544] rounded-xl p-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>
          </div>

          {/* Rodapé com botões */}
          <div className="pt-4 border-t border-[#2d3544] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-[#232936] hover:bg-[#2e3748] text-slate-300 rounded-xl text-sm font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-600/20 active:scale-95 flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              {dependente ? 'Salvar Alterações' : 'Adicionar Dependente'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
