import React, { useState, useEffect } from 'react';
import { Requisicao } from '../../types/requisicoes';
import { Empresa } from '../../services/empresasService';
import { VisualizadorDocumentoPadraoModal } from '../documentos/VisualizadorDocumentoPadraoModal';
import { DocumentoPadrao } from '../../types/documentos';
import { getCredenciadoById } from '../../services/credenciadosService';
import { resolverVariaveisRequisicao, resolverVariaveisSistema } from '../../utils/documentoVariaveis';
import { useAppContext } from '../../context/AppContext';

interface RequisicaoDocumentoPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  requisicao: Requisicao | null;
  empresaData?: Empresa | null;
}

const TEMPLATE_HTML = `
<div style="font-family: Arial, sans-serif; color: #1e293b;">
  <h2 style="text-align: center; font-size: 18px; margin-bottom: 5px; font-weight: bold; text-transform: uppercase;">
    Guia de Autorização / Requisição de Serviço
  </h2>
  <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 10px;">
    <span><b>Status:</b> {{requisicao_status}}</span>
    <span><b>Código:</b> {{requisicao_codigo}}</span>
  </div>
  <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 15px;">
    <span><b>Data de Emissão:</b> {{requisicao_data_emissao}}</span>
    <span><b>Validade:</b> {{requisicao_data_validade}}</span>
  </div>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
    <thead>
      <tr>
        <th style="background-color: #3b82f6; color: white; padding: 6px; text-align: left; font-size: 12px; font-weight: bold;">
          DADOS DO ASSOCIADO E PACIENTE (BENEFICIÁRIO)
        </th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; line-height: 1.4;">
          <b>Titular Associado:</b> {{requisicao_paciente_nome}} <br/>
          <b>Paciente / Beneficiário:</b> {{requisicao_paciente_nome}} <br/>
          <b>CPF Paciente:</b> {{requisicao_paciente_cpf}}
        </td>
      </tr>
    </tbody>
  </table>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
    <thead>
      <tr>
        <th style="background-color: #3b82f6; color: white; padding: 6px; text-align: left; font-size: 12px; font-weight: bold;">
          PRESTADOR DE SERVIÇO / REDE ATENDENTE
        </th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; line-height: 1.4;">
          <b>Prestador / Clínica:</b> {{requisicao_credenciado_nome}}<br/>
          <b>Especialidade:</b> {{requisicao_credenciado_especialidade}}<br/>
          <b>Médico Solicitante:</b> {{requisicao_medico_solicitante}} {{requisicao_crm_solicitante}}
        </td>
      </tr>
    </tbody>
  </table>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
    <thead>
      <tr>
        <th style="background-color: #1e293b; color: white; padding: 6px; text-align: left; font-size: 11px; font-weight: bold;">
          Cód. TUSS / Ref.
        </th>
        <th style="background-color: #1e293b; color: white; padding: 6px; text-align: left; font-size: 11px; font-weight: bold;">
          Descrição do Procedimento / Exame
        </th>
        <th style="background-color: #1e293b; color: white; padding: 6px; text-align: center; font-size: 11px; font-weight: bold; width: 50px;">
          Qtd
        </th>
      </tr>
    </thead>
    <tbody>
      {{requisicao_itens_lista}}
    </tbody>
  </table>

  <div style="font-size: 11px; color: #64748b; margin-bottom: 40px; line-height: 1.4;">
    <b>Termo de Autorização:</b> A apresentação desta guia autoriza a realização dos exames/procedimentos listados acima.<br/>
    O beneficiário e o credenciado declaram ciência dos termos do regulamento da assistência contratada.
  </div>

  <div style="display: flex; justify-content: space-between; margin-top: 60px;">
    <div style="width: 45%; text-align: center; border-top: 1px solid #cbd5e1; padding-top: 5px;">
      <span style="font-size: 11px; font-weight: bold;">Assinatura do Paciente / Responsável</span>
    </div>
    <div style="width: 45%; text-align: center; border-top: 1px solid #cbd5e1; padding-top: 5px;">
      <span style="font-size: 11px; font-weight: bold;">Carimbo e Assinatura da Empresa</span>
    </div>
  </div>
</div>
`;

export const RequisicaoDocumentoPreview: React.FC<RequisicaoDocumentoPreviewProps> = ({
  isOpen,
  onClose,
  requisicao,
  empresaData
}) => {
  const { state } = useAppContext();
  const [loading, setLoading] = useState(false);
  const [documentoMock, setDocumentoMock] = useState<DocumentoPadrao | null>(null);
  const [placeholders, setPlaceholders] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen || !requisicao) {
      setDocumentoMock(null);
      return;
    }

    let isMounted = true;
    
    const preparePreview = async () => {
      setLoading(true);
      let especialidade = 'Não Informada';
      
      try {
        if (requisicao.credenciado_id) {
          const cred = await getCredenciadoById(requisicao.credenciado_id, state.isOnline);
          if (cred && cred.especialidade) {
            especialidade = cred.especialidade;
          }
        }
      } catch (err) {
        console.warn('Erro ao carregar especialidade do credenciado:', err);
      }

      if (!isMounted) return;

      const baseVars = resolverVariaveisSistema(new Date());
      const reqVars = resolverVariaveisRequisicao(requisicao, especialidade);

      setPlaceholders({ ...baseVars, ...reqVars });
      
      // `nome` e `conteudo` são os campos que o visualizador realmente lê.
      // Antes isto montava `titulo` (campo inexistente) e `conteudo_html` — a
      // coluna legada do drift de schema documentado no CLAUDE.md —, e o
      // resultado era um modal que abria sem título e com o corpo em branco.
      const docPadrao: DocumentoPadrao = {
        id: 'mock-req-' + requisicao.id,
        nome: `Guia ${requisicao.codigo_requisicao}`,
        tipo: 'outro',
        conteudo: TEMPLATE_HTML,
        ativo: true,
        criado_em: requisicao.data_emissao,
        atualizado_em: requisicao.data_emissao,
        empresa_id: requisicao.tenant_id,
      };
      
      setDocumentoMock(docPadrao);
      setLoading(false);
    };

    preparePreview();

    return () => {
      isMounted = false;
    };
  }, [isOpen, requisicao, state.isOnline]);

  if (!isOpen) return null;
  if (loading || !documentoMock) return null; // We can show a spinner in the future if loading takes too long

  return (
    <VisualizadorDocumentoPadraoModal
      isOpen={isOpen}
      onClose={onClose}
      documento={documentoMock}
      empresaData={empresaData}
      initialPlaceholderValues={placeholders}
      customTitle={`Imprimir Guia: ${requisicao?.codigo_requisicao}`}
    />
  );
};
