import React, { useState, useEffect } from 'react';
import { getTemplates, saveTemplates, MensagemTemplate } from '../../services/templatesService';
import { Save, MessageCircle, Info } from 'lucide-react';
import toast from 'react-hot-toast';

export const MensagensConfigTab: React.FC = () => {
  const [templates, setTemplates] = useState<MensagemTemplate>({
    boasVindas: '',
    cobrança: '',
    renovacao: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const data = await getTemplates();
      setTemplates(data);
    } catch (error) {
      toast.error('Erro ao carregar templates.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveTemplates(templates);
      toast.success('Templates salvos com sucesso!');
    } catch (error) {
      toast.error('Erro ao salvar templates.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-400">Carregando templates...</div>;
  }

  return (
    <div className="flex-1 bg-[#181B34] border border-[#262A45] rounded-2xl overflow-hidden shadow-sm flex flex-col">
      <div className="p-4 border-b border-[#262A45] bg-[#101223]/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-[#7E4CF3]" />
          <h3 className="font-semibold text-white">Templates de WhatsApp</h3>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-[#7E4CF3] text-white rounded-xl text-sm font-medium hover:bg-[#6A3DE8] transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Salvando...' : 'Salvar Alterações'}
        </button>
      </div>

      <div className="p-6 overflow-y-auto space-y-8">
        <div className="space-y-4">
          <div>
            <h4 className="text-lg font-medium text-white mb-1">Boas Vindas</h4>
            <p className="text-sm text-slate-400 mb-3">
              Enviado para novos associados. Variáveis disponíveis: <code className="bg-[#101223] px-1.5 py-0.5 rounded text-[#7E4CF3]">{'{nome}'}</code>
            </p>
          </div>
          <textarea
            value={templates.boasVindas}
            onChange={(e) => setTemplates(prev => ({ ...prev, boasVindas: e.target.value }))}
            className="w-full h-32 px-4 py-3 bg-[#101223] border border-[#262A45] rounded-xl text-slate-300 focus:outline-none focus:border-[#7E4CF3] transition-colors resize-none"
            placeholder="Digite a mensagem de boas vindas..."
          />
        </div>

        <div className="space-y-4">
          <div>
            <h4 className="text-lg font-medium text-white mb-1">Cobrança</h4>
            <p className="text-sm text-slate-400 mb-3">
              Enviado para recebimentos pendentes. Variáveis disponíveis: <code className="bg-[#101223] px-1.5 py-0.5 rounded text-[#7E4CF3]">{'{nome}'}</code>, <code className="bg-[#101223] px-1.5 py-0.5 rounded text-[#7E4CF3]">{'{valor}'}</code>, <code className="bg-[#101223] px-1.5 py-0.5 rounded text-[#7E4CF3]">{'{vencimento}'}</code>
            </p>
          </div>
          <textarea
            value={templates.cobrança}
            onChange={(e) => setTemplates(prev => ({ ...prev, cobrança: e.target.value }))}
            className="w-full h-40 px-4 py-3 bg-[#101223] border border-[#262A45] rounded-xl text-slate-300 focus:outline-none focus:border-[#7E4CF3] transition-colors resize-none"
            placeholder="Digite a mensagem de cobrança..."
          />
        </div>

        <div className="space-y-4">
          <div>
            <h4 className="text-lg font-medium text-white mb-1">Lembrete de Renovação</h4>
            <p className="text-sm text-slate-400 mb-3">
              Enviado para alertar sobre renovação de contrato. Variáveis disponíveis: <code className="bg-[#101223] px-1.5 py-0.5 rounded text-[#7E4CF3]">{'{nome}'}</code>, <code className="bg-[#101223] px-1.5 py-0.5 rounded text-[#7E4CF3]">{'{plano}'}</code>
            </p>
          </div>
          <textarea
            value={templates.renovacao}
            onChange={(e) => setTemplates(prev => ({ ...prev, renovacao: e.target.value }))}
            className="w-full h-32 px-4 py-3 bg-[#101223] border border-[#262A45] rounded-xl text-slate-300 focus:outline-none focus:border-[#7E4CF3] transition-colors resize-none"
            placeholder="Digite a mensagem de renovação..."
          />
        </div>
        
        <div className="bg-[#7E4CF3]/10 border border-[#7E4CF3]/20 rounded-xl p-4 flex gap-3">
          <Info className="w-5 h-5 text-[#7E4CF3] shrink-0" />
          <p className="text-sm text-[#7E4CF3]">
            As variáveis como {'{nome}'} e {'{valor}'} serão substituídas automaticamente pelos dados reais do cliente no momento do envio.
          </p>
        </div>
      </div>
    </div>
  );
};
