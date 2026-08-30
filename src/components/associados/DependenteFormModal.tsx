import React, { useState, useEffect } from 'react';
import { 
  X, 
  User, 
  Users, 
  Calendar, 
  CreditCard, 
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
  'CÔNJUGE / ESPOSO(A)',
  'FILHO(A)',
  'ENTEADO(A)',
  'PAI / MÃE',
  'SOGRO(A)',
  'IRMÃO(Ã)',
  'NETO(A)',
  'AVÔ / AVÓ',
  'TIO(A)',
  'SOBRINHO(A)',
  'GENRO / NORA',
  'OUTRO'
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
  const [dataNascimento, setDataNascimento] = useState('');
  const [parentesco, setParentesco] = useState('');
  const [cpf, setCpf] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Preenche dados quando abre para edição ou reseta para novo
  useEffect(() => {
    if (!isOpen) return;

    if (dependente) {
      setNome(dependente.nome || '');
      setDataNascimento(dependente.data_nascimento ? dependente.data_nascimento.split('T')[0] : '');
      setParentesco(dependente.parentesco || '');
      setCpf(dependente.cpf ? maskCPFOrCNPJ(dependente.cpf, false) : '');
    } else {
      setNome('');
      setDataNascimento('');
      setParentesco('');
      setCpf('');
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

  const handleSalvar = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    // 1. Nome é OBRIGATÓRIO
    if (!nome.trim() || nome.trim().length < 2) {
      newErrors.nome = 'Informe o nome completo do dependente (campo obrigatório)';
    }

    // 2. Data de Nascimento é OBRIGATÓRIA
    if (!dataNascimento.trim()) {
      newErrors.dataNascimento = 'Informe a data de nascimento do dependente (campo obrigatório)';
    } else {
      const date = parseISO(dataNascimento);
      if (!isValid(date)) {
        newErrors.dataNascimento = 'Data de nascimento inválida.';
      } else if (date > new Date()) {
        newErrors.dataNascimento = 'Data de nascimento não pode ser uma data futura.';
      }
    }

    // 3. CPF é OPCIONAL (se preenchido, deve ser válido)
    if (cpf.trim()) {
      if (cpfValidationState === 'invalid') {
        newErrors.cpf = 'CPF inválido. Verifique os números digitados.';
      } else if (cpfValidationState === 'duplicate') {
        newErrors.cpf = 'Este CPF já está cadastrado em outro dependente deste associado.';
      }
    }

    // 4. Parentesco é OPCIONAL (não gera erro)

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      const firstError = Object.values(newErrors)[0];
      toast.error(firstError);
      return;
    }

    // Apenas campos existentes na tabela 'dependentes' do Supabase
    const depData: Dependente = {
      id: dependente?.id || uuidv4(),
      nome: nome.trim().toUpperCase(),
      data_nascimento: dataNascimento.trim(),
      parentesco: parentesco.trim() ? parentesco.trim().toUpperCase() : 'OUTRO',
      cpf: cpf.trim() || undefined
    };

    onSave(depData);
    toast.success(dependente ? 'Dependente atualizado com sucesso!' : 'Dependente adicionado com sucesso!');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#181d27] border border-[#2d3544] w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
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
                {titularNome ? `Associado Titular: ${titularNome}` : 'Campos obrigatórios: Nome e Data de Nascimento'}
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
        <form onSubmit={handleSalvar} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 custom-scrollbar text-white">
          
          {/* Card Informativo de Vínculo Contratual */}
          <div className="p-3.5 bg-gradient-to-r from-blue-900/30 to-indigo-900/20 border border-blue-500/30 rounded-2xl flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-200 leading-relaxed">
              <span className="font-bold text-white">Regra de Contrato: </span>
              A inclusão ou alteração de dependentes é refletida no cálculo de mensalidades do plano contratado e fica disponível para emissão de Termos Aditivos.
            </div>
          </div>

          {/* DADOS DO DEPENDENTE (Apenas campos da tabela Supabase) */}
          <div className="space-y-4">
            
            {/* Nome Completo (OBRIGATÓRIO) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                Nome Completo <span className="text-rose-400 font-bold">*</span>
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
                    errors.nome ? 'border-rose-500 focus:border-rose-500 ring-1 ring-rose-500/50' : 'border-[#2d3544] focus:border-blue-500'
                  }`}
                />
              </div>
              {errors.nome && <p className="text-[11px] text-rose-400 font-medium">{errors.nome}</p>}
            </div>

            {/* Data de Nascimento (OBRIGATÓRIA) e Grau de Parentesco (OPCIONAL) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Data de Nascimento com cálculo de idade */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-300">
                    Data de Nascimento <span className="text-rose-400 font-bold">*</span>
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
                    errors.dataNascimento ? 'border-rose-500 focus:border-rose-500 ring-1 ring-rose-500/50' : 'border-[#2d3544] focus:border-blue-500'
                  }`}
                />
                {errors.dataNascimento && <p className="text-[11px] text-rose-400 font-medium">{errors.dataNascimento}</p>}
              </div>

              {/* Grau de Parentesco (OPCIONAL) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Grau de Parentesco <span className="text-slate-500 font-normal">(Opcional)</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    list="parentesco-options-list"
                    value={parentesco}
                    onChange={(e) => {
                      setParentesco(e.target.value.toUpperCase());
                      if (errors.parentesco) setErrors(prev => ({ ...prev, parentesco: '' }));
                    }}
                    placeholder="Ex: Filho(a), Cônjuge, Pai/Mãe..."
                    className="w-full bg-[#13171f] border border-[#2d3544] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-colors uppercase"
                  />
                  <datalist id="parentesco-options-list">
                    {OPCOES_PARENTESCO.map(op => (
                      <option key={op} value={op} />
                    ))}
                  </datalist>
                </div>
                <p className="text-[10px] text-slate-500">Selecione uma opção da lista ou digite livremente</p>
              </div>

            </div>

            {/* CPF (OPCIONAL) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-300">
                  CPF <span className="text-slate-500 font-normal">(Opcional)</span>
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
                    ? 'border-rose-500 focus:border-rose-500 ring-1 ring-rose-500/50' 
                    : cpfValidationState === 'valid' 
                    ? 'border-emerald-500/50 focus:border-emerald-500' 
                    : 'border-[#2d3544] focus:border-blue-500'
                }`}
              />
              {errors.cpf && <p className="text-[11px] text-rose-400 font-medium">{errors.cpf}</p>}
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
