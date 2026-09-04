import React from 'react';
import { Fornecedor, StatusFornecedor } from '../../types/fornecedores';
import {
  X,
  Pencil,
  Building,
  User,
  MapPin,
  Phone,
  Mail,
  CreditCard,
  FileText,
  Globe,
  Tag,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  AlertOctagon,
  Copy,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  fornecedor: Fornecedor;
  onClose: () => void;
  onEdit: () => void;
  onStatusChange: (id: string, novoStatus: StatusFornecedor) => Promise<void>;
}

export const FornecedorDetailsModal: React.FC<Props> = ({
  fornecedor,
  onClose,
  onEdit,
  onStatusChange,
}) => {
  const getStatusBadge = (status: StatusFornecedor) => {
    switch (status) {
      case 'ativo':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Ativo
          </span>
        );
      case 'inativo':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/20">
            <XCircle className="w-3.5 h-3.5" />
            Inativo
          </span>
        );
      case 'bloqueado':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertOctagon className="w-3.5 h-3.5" />
            Bloqueado
          </span>
        );
    }
  };

  const getTipoFornecedorBadge = (tipo: string) => {
    switch (tipo) {
      case 'produtos':
        return (
          <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            Produtos / Insumos
          </span>
        );
      case 'servicos':
        return (
          <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
            Prestador de Serviços
          </span>
        );
      case 'ambos':
        return (
          <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            Produtos & Serviços
          </span>
        );
      default:
        return null;
    }
  };

  const copiarTexto = (texto: string, rotulo: string) => {
    navigator.clipboard.writeText(texto);
    toast.success(`${rotulo} copiado para a área de transferência!`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-base/80 backdrop-blur-sm p-4">
      <div className="bg-bg-subtle rounded-3xl shadow-2xl w-full max-w-3xl max-h-[88vh] flex flex-col border border-border-default overflow-hidden animate-in fade-in zoom-in-95">
        {/* HEADER */}
        <div className="p-6 border-b border-border-default bg-bg-surface/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3.5 bg-[#3B82F6]/10 text-[#3B82F6] rounded-2xl border border-[#3B82F6]/20 shrink-0">
              <Building className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs font-bold text-text-subtle">
                  {fornecedor.codigo}
                </span>
                {getStatusBadge(fornecedor.status)}
                {getTipoFornecedorBadge(fornecedor.tipo_fornecedor)}
              </div>
              <h2 className="text-xl font-bold text-text-base mt-1">{fornecedor.nome_fantasia}</h2>
              <p className="text-xs text-text-subtle">{fornecedor.razao_social}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#3B82F6]/10 text-[#3B82F6] hover:bg-[#3B82F6]/20 border border-[#3B82F6]/30 rounded-xl text-xs font-semibold transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              Editar
            </button>
            <button
              onClick={onClose}
              className="p-2 text-text-subtle hover:text-text-base rounded-xl transition-colors hover:bg-bg-hover"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* BODY */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          {/* QUICK SUMMARY CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-bg-surface p-4 rounded-2xl border border-border-default/60">
              <p className="text-[11px] font-semibold text-text-subtle uppercase tracking-wider">
                Identificação
              </p>
              <p className="text-sm font-bold text-text-base font-mono mt-1 flex items-center justify-between">
                <span>{fornecedor.cnpj_cpf}</span>
                <button
                  onClick={() => copiarTexto(fornecedor.cnpj_cpf, 'Documento')}
                  className="text-text-subtle hover:text-[#3B82F6] p-1"
                  title="Copiar"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </p>
              <p className="text-xs text-text-subtle mt-0.5">
                Tipo: {fornecedor.tipo_pessoa || 'PJ'}
              </p>
            </div>

            <div className="bg-bg-surface p-4 rounded-2xl border border-border-default/60">
              <p className="text-[11px] font-semibold text-text-subtle uppercase tracking-wider">
                Categoria
              </p>
              <p className="text-sm font-bold text-text-base mt-1">{fornecedor.categoria}</p>
              <p className="text-xs text-text-subtle mt-0.5">Segmento de fornecimento</p>
            </div>

            <div className="bg-bg-surface p-4 rounded-2xl border border-border-default/60">
              <p className="text-[11px] font-semibold text-text-subtle uppercase tracking-wider">
                Inscrições Fiscal
              </p>
              <p className="text-xs text-text-base mt-1">
                <strong className="text-text-subtle">IE:</strong>{' '}
                {fornecedor.inscricao_estadual || 'Isento/Não informado'}
              </p>
              <p className="text-xs text-text-base mt-0.5">
                <strong className="text-text-subtle">IM:</strong>{' '}
                {fornecedor.inscricao_municipal || 'Não informada'}
              </p>
            </div>
          </div>

          {/* CONTATO & ENDEREÇO GRID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* CONTATOS */}
            <div className="bg-bg-surface p-5 rounded-2xl border border-border-default/60 space-y-3">
              <h3 className="text-xs font-bold text-[#3B82F6] uppercase tracking-wider flex items-center gap-1.5">
                <Phone className="w-4 h-4" />
                <span>Canais de Contato</span>
              </h3>

              <div className="space-y-2 text-xs">
                {fornecedor.contato_nome && (
                  <p className="text-text-base">
                    <strong className="text-text-subtle">Responsável:</strong>{' '}
                    {fornecedor.contato_nome}
                  </p>
                )}
                {fornecedor.email && (
                  <p className="text-text-base flex items-center justify-between">
                    <span>
                      <strong className="text-text-subtle">E-mail:</strong> {fornecedor.email}
                    </span>
                    <button
                      onClick={() => copiarTexto(fornecedor.email!, 'E-mail')}
                      className="text-text-subtle hover:text-[#3B82F6] p-0.5"
                      title="Copiar e-mail"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </p>
                )}
                {fornecedor.telefone && (
                  <p className="text-text-base">
                    <strong className="text-text-subtle">Telefone:</strong> {fornecedor.telefone}
                  </p>
                )}
                {fornecedor.celular_whatsapp && (
                  <p className="text-text-base">
                    <strong className="text-text-subtle">Celular / WhatsApp:</strong>{' '}
                    {fornecedor.celular_whatsapp}
                  </p>
                )}
                {fornecedor.website && (
                  <p className="text-text-base truncate">
                    <strong className="text-text-subtle">Website:</strong>{' '}
                    <a
                      href={fornecedor.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#3B82F6] hover:underline"
                    >
                      {fornecedor.website}
                    </a>
                  </p>
                )}
                {!fornecedor.contato_nome &&
                  !fornecedor.email &&
                  !fornecedor.telefone &&
                  !fornecedor.celular_whatsapp && (
                    <p className="text-text-subtle italic">Nenhum canal de contato informado.</p>
                  )}
              </div>
            </div>

            {/* ENDEREÇO */}
            <div className="bg-bg-surface p-5 rounded-2xl border border-border-default/60 space-y-3">
              <h3 className="text-xs font-bold text-[#3B82F6] uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-4 h-4" />
                <span>Endereço Comercial</span>
              </h3>

              <div className="space-y-1.5 text-xs text-text-base">
                {fornecedor.logradouro ? (
                  <>
                    <p className="font-semibold">
                      {fornecedor.logradouro}, {fornecedor.numero || 's/n'}{' '}
                      {fornecedor.complemento ? `(${fornecedor.complemento})` : ''}
                    </p>
                    <p className="text-text-subtle">
                      {fornecedor.bairro || 'Bairro não informado'} - {fornecedor.cidade}/
                      {fornecedor.uf}
                    </p>
                    {fornecedor.cep && (
                      <p className="font-mono text-text-subtle">CEP: {fornecedor.cep}</p>
                    )}
                  </>
                ) : (
                  <p className="text-text-subtle italic">Endereço não cadastrado.</p>
                )}
              </div>
            </div>
          </div>

          {/* DADOS BANCÁRIOS */}
          <div className="bg-bg-surface p-5 rounded-2xl border border-border-default/60 space-y-3">
            <h3 className="text-xs font-bold text-[#3B82F6] uppercase tracking-wider flex items-center gap-1.5">
              <CreditCard className="w-4 h-4" />
              <span>Dados Bancários & Pagamentos</span>
            </h3>

            {fornecedor.dados_bancarios?.banco ? (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <p className="text-[10px] text-text-subtle uppercase">Banco</p>
                  <p className="font-semibold text-text-base">{fornecedor.dados_bancarios.banco}</p>
                </div>
                <div>
                  <p className="text-[10px] text-text-subtle uppercase">Agência / Conta</p>
                  <p className="font-mono text-text-base font-semibold">
                    {fornecedor.dados_bancarios.agencia} / {fornecedor.dados_bancarios.conta}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-text-subtle uppercase">Tipo de Conta</p>
                  <p className="font-semibold text-text-base capitalize">
                    {fornecedor.dados_bancarios.tipo_conta}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-text-subtle uppercase">Chave PIX</p>
                  <p className="font-mono text-text-base font-semibold flex items-center justify-between">
                    <span className="truncate">
                      {fornecedor.dados_bancarios.chave_pix || 'N/A'}
                    </span>
                    {fornecedor.dados_bancarios.chave_pix && (
                      <button
                        onClick={() =>
                          copiarTexto(fornecedor.dados_bancarios!.chave_pix!, 'Chave PIX')
                        }
                        className="text-text-subtle hover:text-[#3B82F6] p-0.5 ml-1"
                        title="Copiar PIX"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    )}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-text-subtle italic">Dados bancários não informados.</p>
            )}
          </div>

          {/* OBSERVAÇÕES */}
          {fornecedor.observacoes && (
            <div className="bg-bg-surface p-5 rounded-2xl border border-border-default/60 space-y-2">
              <h3 className="text-xs font-bold text-[#3B82F6] uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-4 h-4" />
                <span>Observações & Anotações Internas</span>
              </h3>
              <p className="text-xs text-text-muted leading-relaxed whitespace-pre-line">
                {fornecedor.observacoes}
              </p>
            </div>
          )}

          {/* QUICK STATUS SWITCHER BUTTONS */}
          <div className="p-4 rounded-2xl bg-bg-surface/50 border border-border-default/50 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-text-subtle font-medium">Alterar Status Rápido:</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onStatusChange(fornecedor.id, 'ativo')}
                disabled={fornecedor.status === 'ativo'}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                  fornecedor.status === 'ativo'
                    ? 'bg-emerald-500 text-white border-emerald-500 opacity-50 cursor-not-allowed'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                }`}
              >
                Ativar
              </button>
              <button
                onClick={() => onStatusChange(fornecedor.id, 'inativo')}
                disabled={fornecedor.status === 'inativo'}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                  fornecedor.status === 'inativo'
                    ? 'bg-slate-500 text-white border-slate-500 opacity-50 cursor-not-allowed'
                    : 'bg-slate-500/10 text-slate-400 border-slate-500/20 hover:bg-slate-500/20'
                }`}
              >
                Inativar
              </button>
              <button
                onClick={() => onStatusChange(fornecedor.id, 'bloqueado')}
                disabled={fornecedor.status === 'bloqueado'}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                  fornecedor.status === 'bloqueado'
                    ? 'bg-rose-500 text-white border-rose-500 opacity-50 cursor-not-allowed'
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20'
                }`}
              >
                Bloquear
              </button>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="p-4 border-t border-border-default bg-bg-surface/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-bg-hover text-text-base rounded-xl text-xs font-medium hover:bg-[#64748B] transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
