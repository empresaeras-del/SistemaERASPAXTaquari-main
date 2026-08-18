import React, { useState } from 'react';
import { X, User, MapPin, Phone, CreditCard, ShieldCheck, Heart, FileText, FolderOpen, Calendar, Edit2, Copy, CopyCheck, Printer } from 'lucide-react';
import { Associado } from '../../services/associadosService';
import { getEmpresaById } from '../../services/empresasService';
import { useAppContext } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { formatLocalDate } from '../../utils/dateUtils';

interface Props {
  associado: Associado;
  onClose: () => void;
  onEdit: (associado: Associado) => void;
}

export const AssociadoDetailsModal: React.FC<Props> = ({ associado, onClose, onEdit }) => {
  const toast = useToast();
  const { state } = useAppContext();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copiarTexto = async (texto: string, label: string, id: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiedId(id);
      toast.success(`${label} copiado!`);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      toast.error('Erro ao copiar');
    }
  };

  
  const handlePrint = async () => {
    let logoHtml = '';
    try {
      const tenantId = state.empresaSelecionada;
      if (tenantId) {
        const empresa = await getEmpresaById(tenantId, state.isOnline);
        if (empresa?.logo_url) {
          logoHtml = `<div style="width: 100%; text-align: center; margin-bottom: 20px;"><img src="${empresa.logo_url}" style="width: 100%; max-height: 120px; object-fit: contain;" /></div>`;
        }
      }
    } catch (e) {
      console.error('Erro ao buscar logo:', e);
    }

    const printContent = `
      <html>
        <head>
          <title>Ficha de Cadastro - ${associado.nome}</title>
          <style>
            body { font-family: sans-serif; padding: 20px; color: #333; }
            h1 { font-size: 24px; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
            h2 { font-size: 18px; margin-top: 20px; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
            p { margin: 5px 0; font-size: 14px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
            .full { grid-column: span 2; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #ccc; padding: 8px; text-align: left; font-size: 14px; }
            th { background-color: #f5f5f5; }
            @media print {
              body { padding: 0; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          ${logoHtml}
          <h1>Ficha de Cadastro - Associado</h1>
          
          <h2>Dados Pessoais</h2>
          <div class="grid">
            <p><strong>Nome:</strong> ${associado.nome}</p>
            <p><strong>CPF:</strong> ${associado.cpf}</p>
            <p><strong>RG:</strong> ${associado.rg || 'Não informado'}</p>
            <p><strong>Data de Nascimento:</strong> ${formatLocalDate(associado.data_nascimento, 'dd/MM/yyyy', 'Não informada')}</p>
            <p><strong>Sexo:</strong> ${associado.sexo || 'Não informado'}</p>
            <p><strong>Status:</strong> ${associado.status.toUpperCase()}</p>
            <p><strong>Data de Adesão:</strong> ${formatLocalDate(associado.data_adesao, 'dd/MM/yyyy', 'Não informada')}</p>
          </div>

          <h2>Contato</h2>
          <div class="grid">
            <p><strong>Telefone:</strong> ${associado.telefone || 'Não informado'}</p>
            <p><strong>E-mail:</strong> ${associado.email || 'Não informado'}</p>
          </div>

          <h2>Endereço Residencial</h2>
          <p><strong>Logradouro:</strong> ${associado.endereco_logradouro || ''} ${associado.endereco_numero ? ', ' + associado.endereco_numero : 's/n'}</p>
          <div class="grid">
            <p><strong>Bairro:</strong> ${associado.endereco_bairro || ''}</p>
            <p><strong>Cidade/UF:</strong> ${associado.endereco_cidade || ''}</p>
            <p><strong>CEP:</strong> ${associado.endereco_cep || ''}</p>
            
          </div>

          <h2>Filiação</h2>
          <div class="grid">
            <p><strong>Nome da Mãe:</strong> ${associado.nome_mae || 'Não informado'}</p>
            <p><strong>Nome do Pai:</strong> ${associado.nome_pai || 'Não informado'}</p>
          </div>

          <h2>Plano & Contrato</h2>
          <div class="grid">
            <p><strong>Plano Atual:</strong> ${associado.plano_nome || 'Sem plano vinculado'}</p>
            <p><strong>Valor do Plano:</strong> ${associado.valor_plano ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(associado.valor_plano) : 'R$ 0,00'}</p>
            <p><strong>Total de Vidas:</strong> ${associado.n_vidas || 1}</p>
            
          </div>

          <h2>Dependentes (${associado.dependentes?.length || 0})</h2>
          ${associado.dependentes && associado.dependentes.length > 0 ? `
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Parentesco</th>
                  <th>CPF</th>
                  <th>Data de Nascimento</th>
                </tr>
              </thead>
              <tbody>
                ${associado.dependentes.map(dep => `
                  <tr>
                    <td>${dep.nome}</td>
                    <td>${dep.parentesco || ''}</td>
                    <td>${dep.cpf || ''}</td>
                    <td>${formatLocalDate(dep.data_nascimento, 'dd/MM/yyyy', '')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : '<p>Nenhum dependente cadastrado.</p>'}
          
          <div style="margin-top: 50px; text-align: center;">
            <p>____________________________________________________</p>
            <p>Assinatura do Associado</p>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ativo': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'inativo':
      case 'encerrado': return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
      case 'inadimplente': return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Não informado';
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    try {
        return new Date(dateStr).toLocaleDateString('pt-BR');
    } catch(e) {
        return dateStr;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-bg-base border border-border-default rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* HEADER */}
        <div className="flex items-center justify-between p-6 border-b border-border-default bg-bg-surface/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#3B82F6] to-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
              <User className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-text-base">{associado.nome}</h2>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(associado.status)}`}>
                  {associado.status === 'inativo' ? 'encerrado' : associado.status}
                </span>
              </div>
              <p className="text-sm text-text-subtle mt-0.5">
                CPF: {associado.cpf}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            
            <button
              onClick={handlePrint}
              title="Imprimir Ficha"
              className="p-2 text-text-subtle hover:text-text-base hover:bg-bg-hover rounded-xl transition-colors"
            >
              <Printer className="w-5 h-5" />
            </button>
            <button
              onClick={() => onEdit(associado)}
              className="flex items-center gap-2 px-4 py-2 bg-[#3B82F6]/10 text-[#3B82F6] rounded-xl hover:bg-[#3B82F6]/20 transition-colors font-medium text-xs"
            >
              <Edit2 className="w-4 h-4" />
              Editar
            </button>
            <button
              onClick={onClose}
              className="p-2 text-text-subtle hover:text-text-base hover:bg-bg-hover rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* INFORMAÇÕES PESSOAIS */}
            <div className="bg-bg-surface p-5 rounded-2xl border border-border-default/60 space-y-4">
              <h3 className="text-xs font-bold text-[#3B82F6] uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-4 h-4" />
                <span>Dados Pessoais & Contato</span>
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] text-text-subtle uppercase">RG</p>
                  <p className="font-semibold text-text-base">{associado.rg || 'Não informado'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-text-subtle uppercase">Data Nasc.</p>
                  <p className="font-semibold text-text-base">{formatLocalDate(associado.data_nascimento)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-text-subtle uppercase">Sexo</p>
                  <p className="font-semibold text-text-base capitalize">{associado.sexo || 'Não informado'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-text-subtle uppercase">Adesão</p>
                  <p className="font-semibold text-text-base">{formatLocalDate(associado.data_adesao)}</p>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-border-default/50">
                {associado.telefone && (
                  <p className="text-sm flex items-center justify-between">
                    <span className="flex items-center gap-2"><Phone className="w-4 h-4 text-text-subtle" /> {associado.telefone}</span>
                    <button onClick={() => copiarTexto(associado.telefone!, 'Telefone', 'tel')} className="text-text-subtle hover:text-[#3B82F6]">
                      {copiedId === 'tel' ? <CopyCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </p>
                )}
                {associado.email && (
                  <p className="text-sm flex items-center justify-between">
                    <span className="flex items-center gap-2 truncate"><FileText className="w-4 h-4 text-text-subtle" /> {associado.email}</span>
                    <button onClick={() => copiarTexto(associado.email!, 'E-mail', 'email')} className="text-text-subtle hover:text-[#3B82F6]">
                      {copiedId === 'email' ? <CopyCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </p>
                )}
                {!associado.telefone && !associado.email && (
                  <p className="text-sm text-text-subtle italic">Nenhum contato informado.</p>
                )}
              </div>
            </div>

            {/* ENDEREÇO */}
            <div className="bg-bg-surface p-5 rounded-2xl border border-border-default/60 space-y-4">
              <h3 className="text-xs font-bold text-[#3B82F6] uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-4 h-4" />
                <span>Endereço Residencial</span>
              </h3>
              
              <div className="space-y-2 text-sm text-text-base">
                {associado.endereco_logradouro ? (
                  <>
                    <p className="font-semibold">{associado.endereco_logradouro}, {associado.endereco_numero || 's/n'}</p>
                    <p className="text-text-subtle">{associado.endereco_bairro || 'Bairro não informado'} - {associado.endereco_cidade || 'Cidade não informada'}</p>
                    {associado.endereco_cep && <p className="font-mono text-text-subtle">CEP: {associado.endereco_cep}</p>}
                  </>
                ) : (
                  <p className="text-text-subtle italic">Endereço não cadastrado.</p>
                )}
              </div>

              <div className="pt-4 border-t border-border-default/50">
                <h4 className="text-[10px] text-text-subtle uppercase mb-2">Filiação</h4>
                <div className="space-y-1">
                  <p className="text-sm"><span className="text-text-subtle">Mãe:</span> {associado.nome_mae || 'Não informado'}</p>
                  <p className="text-sm"><span className="text-text-subtle">Pai:</span> {associado.nome_pai || 'Não informado'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* PLANO & CONTRATO */}
          <div className="bg-bg-surface p-5 rounded-2xl border border-border-default/60 space-y-4">
            <h3 className="text-xs font-bold text-[#3B82F6] uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              <span>Plano & Contrato</span>
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-bg-subtle p-3 rounded-xl border border-border-default">
                <p className="text-[10px] text-text-subtle uppercase mb-1">Plano Atual</p>
                <p className="font-semibold text-text-base">{associado.plano_nome || 'Sem plano vinculado'}</p>
              </div>
              <div className="bg-bg-subtle p-3 rounded-xl border border-border-default">
                <p className="text-[10px] text-text-subtle uppercase mb-1">Valor do Plano</p>
                <p className="font-semibold text-text-base">
                  {associado.valor_plano ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(associado.valor_plano) : 'R$ 0,00'}
                </p>
              </div>
              <div className="bg-bg-subtle p-3 rounded-xl border border-border-default">
                <p className="text-[10px] text-text-subtle uppercase mb-1">Total de Vidas</p>
                <p className="font-semibold text-text-base">{associado.n_vidas || 1} vida(s)</p>
              </div>
            </div>
          </div>

          {/* DEPENDENTES */}
          <div className="bg-bg-surface p-5 rounded-2xl border border-border-default/60 space-y-4">
            <h3 className="text-xs font-bold text-[#3B82F6] uppercase tracking-wider flex items-center gap-1.5">
              <Heart className="w-4 h-4" />
              <span>Dependentes ({associado.dependentes?.length || 0})</span>
            </h3>
            
            {associado.dependentes && associado.dependentes.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {associado.dependentes.map(dep => (
                  <div key={dep.id} className="flex items-center justify-between p-3 bg-bg-subtle border border-border-default rounded-xl">
                    <div>
                      <p className="text-sm font-semibold text-text-base">{dep.nome}</p>
                      <p className="text-xs text-text-subtle">{dep.parentesco} {dep.cpf ? `• CPF: ${dep.cpf}` : ''}</p>
                    </div>
                    {dep.data_nascimento && (
                      <div className="text-right">
                         <p className="text-[10px] text-text-subtle uppercase">Nascimento</p>
                         <p className="text-xs font-medium text-text-base">{formatLocalDate(dep.data_nascimento)}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-text-subtle italic">Nenhum dependente cadastrado.</p>
            )}
          </div>
          
        </div>

        {/* FOOTER */}
        <div className="p-4 border-t border-border-default bg-bg-surface/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-bg-hover text-text-base rounded-xl text-sm font-medium hover:bg-bg-hover/80 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
