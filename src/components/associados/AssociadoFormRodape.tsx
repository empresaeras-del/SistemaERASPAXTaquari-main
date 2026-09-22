import React from 'react';
import { Associado } from '../../services/associadosService';
import { BotaoSalvar } from '../common/BotaoSalvar';

interface Props {
  activeTab: any;
  executarValidacaoOuAlertar: any;
  handleCloseModal: any;
  isEditingMode: any;
  isSavedAssociado: any;
  isSavingAssociado: any;
  setActiveTab: any;
  state: any;
}

/**
 * O rodapé do formulário, e ele é dois rodapés diferentes.
 *
 * Em **edição** há um botão só, "Salvar Alterações", porque a navegação é livre pelas abas.
 * Em **cadastro** há "Voltar"/"Próximo" percorrendo as cinco etapas, e o submit só aparece
 * na última — a sequência é o que garante que nenhuma etapa obrigatória seja pulada.
 *
 * `BotaoSalvar` é `type="submit"` e envia `#associado-form`. Todo outro botão deste arquivo
 * declara `type="button"`: sem isso, o padrão do HTML é `submit`, e o CLAUDE.md registra o
 * incidente em que exatamente isso salvava o cadastro a cada clique.
 */
export const AssociadoFormRodape: React.FC<Props> = ({ activeTab, executarValidacaoOuAlertar, handleCloseModal, isEditingMode, isSavedAssociado, isSavingAssociado, setActiveTab, state }) => {
  return (
    <div className="p-6 border-t border-border-default bg-bg-surface/50 flex items-center justify-between shrink-0">
      <button
        type="button"
        onClick={handleCloseModal}
        className="px-4 py-2 bg-bg-hover border border-[#64748B] text-text-muted rounded-xl font-medium hover:bg-[#64748B] hover:text-text-base transition-colors"
      >
        Cancelar
      </button>
      <div className="flex gap-3">
        {isEditingMode ? (
          <BotaoSalvar
            type="submit"
            salvando={isSavingAssociado}
            salvo={isSavedAssociado}
            disabled={!state.isOnline}
            texto="Salvar Alterações"
            textoSalvando="Salvando Alterações..."
            textoSalvo="Alterações Salvas!"
            variante="primary"
          />
        ) : (
          <>
            {activeTab !== "principal" && (
              <button
                type="button"
                onClick={() => {
                  if (activeTab === "atendimentos")
                    setActiveTab("requisicoes");
                  else if (activeTab === "requisicoes")
                    setActiveTab("documentos");
                  else if (activeTab === "documentos")
                    setActiveTab("mensalidades");
                  else if (activeTab === "mensalidades")
                    setActiveTab("contratos");
                  else if (activeTab === "contratos")
                    setActiveTab("dependentes");
                  else if (activeTab === "dependentes")
                    setActiveTab("principal");
                }}
                className="px-4 py-2 bg-bg-hover border border-[#64748B] text-text-muted rounded-xl font-medium hover:bg-[#64748B] hover:text-text-base transition-colors"
              >
                Voltar
              </button>
            )}

            {(isEditingMode ? activeTab !== "atendimentos" : activeTab !== "documentos") ? (
              <button
                key="btn-next"
                type="button"
                onClick={() => {
                  if (activeTab === "principal") {
                    if (!executarValidacaoOuAlertar()) return;
                    setActiveTab("dependentes");
                  } else if (activeTab === "dependentes")
                    setActiveTab("contratos");
                  else if (activeTab === "contratos")
                    setActiveTab("mensalidades");
                  else if (activeTab === "mensalidades")
                    setActiveTab("documentos");
                  else if (activeTab === "documentos")
                    setActiveTab("requisicoes");
                  else if (activeTab === "requisicoes")
                    setActiveTab("atendimentos");
                }}
                className="px-4 py-2 bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] text-white rounded-xl font-medium hover:opacity-90 transition-opacity shadow-lg shadow-[#3B82F6]/25"
              >
                Próximo
              </button>
            ) : (
              <BotaoSalvar
                key="btn-submit"
                type="submit"
                salvando={isSavingAssociado}
                salvo={isSavedAssociado}
                disabled={!state.isOnline}
                texto="Finalizar Cadastro"
                textoSalvando="Gravando Associado..."
                textoSalvo="Cadastro Concluído!"
                variante="emerald"
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};
