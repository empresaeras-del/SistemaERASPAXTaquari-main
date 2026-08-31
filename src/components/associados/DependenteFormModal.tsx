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
  ShieldAlert,
  Trash2
} from 'lucide-react';
import { Dependente } from '../../services/associadosService';
import { isValidCPFOrCNPJ, maskCPFOrCNPJ } from '../../utils/validators';
import { differenceInYears, parseISO, isValid } from 'date-fns';
import toast from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';
import { BotaoSalvar } from '../common/BotaoSalvar';
import { AlertaAlteracoesPendentes } from '../common/AlertaAlteracoesPendentes';

export interface DependenteFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  dependente?: Dependente | null;
  onSave: (dep: Dependente) => void;
  onDelete?: (dep: Dependente) => void;
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
  onDelete,
  titularNome,
  existingCpfs = []
}) => {
  const [nome, setNome] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [parentesco, setParentesco] = useState('');
  const [cpf, setCpf] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

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
    setIsSaving(false);
    setIsSaved(false);
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

  const isDirty = React.useMemo(() => {
    if (!isOpen) return false;
    if (dependente) {
      const origNome = dependente.nome || '';
      const origNasc = dependente.data_nascimento ? dependente.data_nascimento.split('T')[0] : '';
      const origParentesco = dependente.parentesco || '';
      const origCpf = dependente.cpf ? maskCPFOrCNPJ(dependente.cpf, false) : '';
      return (
        nome !== origNome ||
        dataNascimento !== origNasc ||
        parentesco !== origParentesco ||
        cpf !== origCpf
      );
    } else {
      return Boolean(nome.trim() || dataNascimento.trim() || parentesco.trim() || cpf.trim());
    }
  }, [isOpen, dependente, nome, dataNascimento, parentesco, cpf]);

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

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      const firstError = Object.values(newErrors)[0];
      toast.error(firstError);
      return;
    }

    setIsSaving(true);
    const depData: Dependente = {
      id: dependente?.id || uuidv4(),
      nome: nome.trim().toUpperCase(),
      data_nascimento: dataNascimento.trim(),
      parentesco: parentesco.trim() ? parentesco.trim().toUpperCase() : 'OUTRO',
      cpf: cpf.trim() || undefined
    };

    setTimeout(() => {
      setIsSaving(false);
      setIsSaved(true);
      onSave(depData);
      toast.success(dependente ? 'Dependente atualizado com sucesso!' : 'Dependente adicionado com sucesso!');
      setTimeout(() => {
        onClose();
      }, 350);
    }, 400);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#181d27] border border-[#2d3544] w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        <div className="p-5 sm:p-6 border-b border-[#2d3544] flex items-center justify-between bg-[#13171f]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">
                {dependente ? 'Editar Dados do Dependente' : 'Cadastrar Novo Dependente'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {titularNome ? `Associado Titular: ${titularNome}` : 'Gerenciamento individual de dependente'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-[#232936] rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSalvar} className="p-5 sm:p-6 overflow-y-auto space-y-4 custom-scrollbar text-white flex-1">
          {isDirty && (
            <AlertaAlteracoesPendentes
              visivel={isDirty}
              salvando={isSaving}
              posicao="compact"
              mensagem="Existem dados pendentes de salvamento para este dependente."
            />
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            <div className="md:col-span-2 space-y-1.5">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                Nome Completo do Dependente <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => {
                    setNome(e.target.value);
                    if (errors.nome) setErrors(prev => ({ ...prev, nome: '' }));
                  }}
                  placeholder="Ex: MARIA SILVA SANTOS"
                  className={`w-full bg-[#13171f] border rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none transition-colors ${
                    errors.nome ? 'border-rose-500 focus:border-rose-500 ring-1 ring-rose-500/50' : 'border-[#2d3544] focus:border-blue-500'
                  }`}
                />
              </div>
              {errors.nome && <p className="text-[11px] text-rose-400 font-medium">{errors.nome}</p>}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Data de Nascimento <span className="text-rose-500">*</span>
                </label>
                {idadeCalculada !== null && (
                  <span className="text-[11px] font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                    {idadeCalculada} {idadeCalculada === 1 ? 'ano' : 'anos'}
                  </span>
                )}
              </div>
              <input
                type="date"
                required
                value={dataNascimento}
                onChange={(e) => {
                  setDataNascimento(e.target.value);
                  if (errors.dataNascimento) setErrors(prev => ({ ...prev, dataNascimento: '' }));
                }}
                className={`w-full bg-[#13171f] border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none transition-colors ${
                  errors.dataNascimento ? 'border-rose-500 focus:border-rose-500 ring-1 ring-rose-500/50' : 'border-[#2d3544] focus:border-blue-500'
                }`}
              />
              {errors.dataNascimento && <p className="text-[11px] text-rose-400 font-medium">{errors.dataNascimento}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                Grau de Parentesco
              </label>
              <div className="relative">
                <input
                  type="text"
                  list="parentesco-opcoes"
                  value={parentesco}
                  onChange={(e) => setParentesco(e.target.value)}
                  placeholder="Selecione ou digite (Ex: FILHO(A))"
                  className="w-full bg-[#13171f] border border-[#2d3544] focus:border-blue-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none transition-colors"
                />
                <datalist id="parentesco-opcoes">
                  {OPCOES_PARENTESCO.map(op => (
                    <option key={op} value={op} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  CPF <span className="text-[10px] text-slate-400 lowercase font-normal">(opcional)</span>
                </label>
                {cpfValidationState === 'valid' && (
                  <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> CPF Válido
                  </span>
                )}
                {cpfValidationState === 'invalid' && (
                  <span className="text-[11px] font-semibold text-rose-400 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> CPF Inválido
                  </span>
                )}
                {cpfValidationState === 'duplicate' && (
                  <span className="text-[11px] font-semibold text-amber-400 flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5" /> CPF Duplicado
                  </span>
                )}
              </div>
              <input
                type="text"
                value={cpf}
                onChange={(e) => {
                  const masked = maskCPFOrCNPJ(e.target.value, false);
                  setCpf(masked);
                  if (errors.cpf) setErrors(prev => ({ ...prev, cpf: '' }));
                }}
                placeholder="000.000.000-00"
                className={`w-full bg-[#13171f] border rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none transition-colors ${
                  errors.cpf ? 'border-rose-500 focus:border-rose-500 ring-1 ring-rose-500/50' : 'border-[#2d3544] focus:border-blue-500'
                }`}
              />
              {errors.cpf && <p className="text-[11px] text-rose-400 font-medium">{errors.cpf}</p>}
            </div>

          </div>

          <div className="pt-4 border-t border-[#2d3544] flex items-center justify-between gap-3">
            <div>
              {dependente && onDelete && (
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => onDelete(dependente)}
                  className="px-3.5 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-xs sm:text-sm font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  title="Excluir este dependente"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Excluir Dependente</span>
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={isSaving}
                onClick={onClose}
                className="px-4 py-2.5 bg-[#232936] hover:bg-[#2e3748] disabled:opacity-50 text-slate-300 rounded-xl text-sm font-semibold transition-colors"
              >
                Cancelar
              </button>
              <BotaoSalvar
                type="submit"
                salvando={isSaving}
                salvo={isSaved}
                texto={dependente ? 'Salvar Alterações' : 'Adicionar Dependente'}
                textoSalvando="Salvando Dependente..."
                textoSalvo="Dependente Salvo!"
                variante="primary"
              />
            </div>
          </div>
        </form>

      </div>
    </div>
  );
};
