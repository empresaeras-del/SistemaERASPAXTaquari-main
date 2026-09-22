import React from 'react';

interface Props {
  activeTab: any;
}

/**
 * O indicador de cinco etapas do modo de CADASTRO, no topo.
 *
 * Ele e `AssociadoAbasLaterais` são excludentes: `isEditingMode` escolhe um dos dois. O
 * cadastro novo é uma sequência (o rodapé só oferece "Próximo"), a edição é navegação livre —
 * por isso um é stepper e o outro é menu, e não duas aparências da mesma coisa.
 */
export const AssociadoEtapasCadastro: React.FC<Props> = ({ activeTab }) => {
  return (
    <div className="px-8 py-5 border-b border-border-default bg-bg-surface/30">
      <div className="flex items-center justify-between max-w-2xl mx-auto">
        {/* Step 1 */}
        <div
          className={`flex flex-col items-center flex-1 ${activeTab === "principal" || activeTab === "dependentes" || activeTab === "contratos" || activeTab === "mensalidades" || activeTab === "documentos" ? "text-[#3B82F6]" : "text-text-subtle"}`}
        >
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold mb-2 transition-colors ${activeTab === "principal" || activeTab === "dependentes" || activeTab === "contratos" || activeTab === "mensalidades" || activeTab === "documentos" ? "bg-[#3B82F6] text-white shadow-[0_0_10px_rgba(59,130,246,0.5)]" : "bg-bg-hover text-text-subtle"}`}
          >
            1
          </div>
          <span className="text-xs font-medium">Dados Básicos</span>
        </div>

        <div
          className={`w-16 h-0.5 mx-2 ${activeTab === "dependentes" || activeTab === "contratos" || activeTab === "mensalidades" || activeTab === "documentos" ? "bg-[#3B82F6]" : "bg-bg-hover"}`}
        ></div>

        {/* Step 2 */}
        <div
          className={`flex flex-col items-center flex-1 ${activeTab === "dependentes" || activeTab === "contratos" || activeTab === "mensalidades" || activeTab === "documentos" ? "text-[#3B82F6]" : "text-text-subtle"}`}
        >
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold mb-2 transition-colors ${activeTab === "dependentes" || activeTab === "contratos" || activeTab === "mensalidades" || activeTab === "documentos" ? "bg-[#3B82F6] text-white shadow-[0_0_10px_rgba(59,130,246,0.5)]" : "bg-bg-hover text-text-subtle"}`}
          >
            2
          </div>
          <span className="text-xs font-medium">Dependentes</span>
        </div>

        <div
          className={`w-16 h-0.5 mx-2 ${activeTab === "contratos" || activeTab === "mensalidades" || activeTab === "documentos" ? "bg-[#3B82F6]" : "bg-bg-hover"}`}
        ></div>

        {/* Step 3 */}
        <div
          className={`flex flex-col items-center flex-1 ${activeTab === "contratos" || activeTab === "mensalidades" || activeTab === "documentos" ? "text-[#3B82F6]" : "text-text-subtle"}`}
        >
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold mb-2 transition-colors ${activeTab === "contratos" || activeTab === "mensalidades" || activeTab === "documentos" ? "bg-[#3B82F6] text-white shadow-[0_0_10px_rgba(59,130,246,0.5)]" : "bg-bg-hover text-text-subtle"}`}
          >
            3
          </div>
          <span className="text-xs font-medium">Contrato</span>
        </div>

        <div
          className={`w-16 h-0.5 mx-2 ${activeTab === "mensalidades" || activeTab === "documentos" ? "bg-[#3B82F6]" : "bg-bg-hover"}`}
        ></div>

        {/* Step 4 */}
        <div
          className={`flex flex-col items-center flex-1 ${activeTab === "mensalidades" || activeTab === "documentos" ? "text-[#3B82F6]" : "text-text-subtle"}`}
        >
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold mb-2 transition-colors ${activeTab === "mensalidades" || activeTab === "documentos" ? "bg-[#3B82F6] text-white shadow-[0_0_10px_rgba(59,130,246,0.5)]" : "bg-bg-hover text-text-subtle"}`}
          >
            4
          </div>
          <span className="text-xs font-medium">Mensalidades</span>
        </div>

        <div
          className={`w-16 h-0.5 mx-2 ${activeTab === "documentos" ? "bg-[#3B82F6]" : "bg-bg-hover"}`}
        ></div>

        {/* Step 5 */}
        <div
          className={`flex flex-col items-center flex-1 ${activeTab === "documentos" ? "text-[#3B82F6]" : "text-text-subtle"}`}
        >
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold mb-2 transition-colors ${activeTab === "documentos" ? "bg-[#3B82F6] text-white shadow-[0_0_10px_rgba(59,130,246,0.5)]" : "bg-bg-hover text-text-subtle"}`}
          >
            5
          </div>
          <span className="text-xs font-medium">Documentos</span>
        </div>
      </div>
    </div>
  );
};
