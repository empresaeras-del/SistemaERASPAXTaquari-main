import React from 'react';
import { Empresa } from '../../services/empresasService';
import { alturaUtilMm, configEmPx, estiloAssinaturaMm, totalPaginasDaFolha } from '../../utils/assinaturaPosicao';
import { sanitizeDocumentoHtml } from '../../utils/sanitizeHtml';
import { Rnd } from 'react-rnd';

interface Props {
  alturaUtilFolhaMm: any;
  areaAssinaturaRef: any;
  assinaturaConfig: any;
  currentEmpresa: any;
  documento: any;
  escalaPxPorMm: any;
  handleAssinaturaDragResizeStop: any;
  isPosicionandoAssinatura: any;
  margens: any;
  orientation: any;
  printAreaRef: any;
  renderedHtml: any;
  zoom: any;
}

export const VisualizadorDocumentoFolha: React.FC<Props> = ({ alturaUtilFolhaMm, areaAssinaturaRef, assinaturaConfig, currentEmpresa, escalaPxPorMm, handleAssinaturaDragResizeStop, isPosicionandoAssinatura, margens, orientation, printAreaRef, renderedHtml, zoom }) => {
  return (
    <>
    <main className="flex-1 overflow-auto bg-[#0a0d14] flex justify-center p-4 sm:p-8 custom-scrollbar relative">
      <div
        style={{
          transform: `scale(${zoom / 100})`,
          transformOrigin: 'top center',
          transition: 'transform 0.15s ease-out',
        }}
        className="shrink-0 my-4"
      >
        {/* Folha A4 Realista */}
        <div
          ref={printAreaRef}
          id="print-area-documento"
          style={{
            width: orientation === 'landscape' ? '297mm' : '210mm',
            minHeight: orientation === 'landscape' ? '210mm' : '297mm',
            // As mesmas margens que o `@page` da impressão recebe. Enquanto
            // eram valores diferentes, a área de texto da tela não batia com a
            // impressa: o texto refluía, a paginação mudava e as guias de
            // página não valiam nada.
            padding: `${margens.top}mm ${margens.right}mm ${margens.bottom}mm ${margens.left}mm`,
            boxSizing: 'border-box',
            position: 'relative',
          }}
          className="bg-white text-slate-900 shadow-[0_20px_50px_rgba(0,0,0,0.6)] rounded-sm flex flex-col justify-between"
        >
          <div>
            {/* Cabeçalho Oficial da Empresa */}
            {currentEmpresa?.logo_url ? (
              <div className="doc-header w-full pb-4 mb-6 border-b-2 border-slate-900 flex items-center justify-center text-center">
                <img
                  src={currentEmpresa.logo_url}
                  alt={currentEmpresa.nome_fantasia || 'Logotipo'}
                  style={{ maxHeight: '85px', maxWidth: '100%', objectFit: 'contain' }}
                  className="mx-auto block"
                />
              </div>
            ) : (
              <div className="doc-header w-full pb-3 mb-6 border-b-2 border-slate-900 text-center">
                <h2 className="text-xl font-bold uppercase tracking-wider text-slate-900 m-0">
                  {currentEmpresa?.nome_fantasia ||
                    currentEmpresa?.razao_social ||
                    'SISTEMA ERAS PAX'}
                </h2>
                {currentEmpresa?.cnpj && (
                  <p className="text-xs text-slate-600 font-medium mt-1">
                    CNPJ: {currentEmpresa.cnpj}
                  </p>
                )}
                {currentEmpresa?.endereco && (
                  <p className="text-[11px] text-slate-500 mt-0.5">{currentEmpresa.endereco}</p>
                )}
              </div>
            )}

            {/* Conteúdo HTML do Documento com Variáveis Substituídas */}
            <div
              className="doc-content prose max-w-none text-slate-800"
              style={{
                fontSize: '11pt',
                lineHeight: '1.6',
                fontFamily: 'Arial, Helvetica, sans-serif',
              }}
              dangerouslySetInnerHTML={{ __html: sanitizeDocumentoHtml(renderedHtml) }}
            />
          </div>

          {/* Rodapé Oficial da Empresa com Assinatura (comportamento padrão/legado: rodapé fixo centralizado) */}
          {!assinaturaConfig && (
            <div className="doc-footer w-full mt-12 pt-6 border-t border-slate-300 flex flex-col items-center justify-center text-center">
              {currentEmpresa?.assinatura_url && (
                <div className="mb-2 flex justify-center">
                  <img
                    src={currentEmpresa.assinatura_url}
                    alt="Assinatura da Empresa"
                    style={{ maxHeight: '70px', maxWidth: '260px', objectFit: 'contain' }}
                  />
                </div>
              )}

              <div className="signature-line w-72 border-t border-slate-900 my-1"></div>
              <p className="text-xs font-bold text-slate-900 uppercase">
                {currentEmpresa?.nome_fantasia ||
                  currentEmpresa?.razao_social ||
                  'Assinatura Autorizada'}
              </p>
              {currentEmpresa?.cnpj && (
                <p className="text-[10px] text-slate-600">CNPJ: {currentEmpresa.cnpj}</p>
              )}
            </div>
          )}

          {/* ── Área útil da folha ────────────────────────────────────────
              Referência de coordenadas da assinatura livre. Cobre exatamente
              a região dentro dos paddings, que é o equivalente da área útil
              da página na impressão — é o que permite os mesmos milímetros
              valerem nos dois lugares. Na impressão, `.doc-assinatura-area`
              é reposicionada para colar em `.doc-container`. */}
          <div
            ref={areaAssinaturaRef}
            className="doc-assinatura-area absolute pointer-events-none"
            style={{
              top: `${margens.top}mm`,
              left: `${margens.left}mm`,
              right: `${margens.right}mm`,
              bottom: `${margens.bottom}mm`,
            }}
          >
            {/* Guias das quebras de página, só enquanto se posiciona: sem elas
                não há como saber em que página a assinatura está sendo solta. */}
            {isPosicionandoAssinatura &&
              Array.from({
                length: totalPaginasDaFolha(alturaUtilFolhaMm, orientation, margens) - 1,
              }).map((_, i) => (
                <div
                  key={i}
                  className="doc-guia-pagina absolute left-0 right-0 border-t border-dashed border-fuchsia-400/60"
                  style={{ top: `${(i + 1) * alturaUtilMm(orientation, margens)}mm` }}
                >
                  <span className="absolute right-0 -top-4 text-[9px] font-bold text-fuchsia-500 bg-white/90 px-1 rounded">
                    pág. {i + 2}
                  </span>
                </div>
              ))}

            {assinaturaConfig && isPosicionandoAssinatura && escalaPxPorMm > 0 && (
              <Rnd
                bounds="parent"
                position={{
                  x: configEmPx(assinaturaConfig, escalaPxPorMm, orientation, margens).x,
                  y: configEmPx(assinaturaConfig, escalaPxPorMm, orientation, margens).y,
                }}
                size={{
                  width: configEmPx(assinaturaConfig, escalaPxPorMm, orientation, margens).largura,
                  height: configEmPx(assinaturaConfig, escalaPxPorMm, orientation, margens).altura,
                }}
                onDragStop={(_e: any, d: any) => {
                  const atual = configEmPx(assinaturaConfig, escalaPxPorMm, orientation, margens);
                  handleAssinaturaDragResizeStop(d.x, d.y, atual.largura, atual.altura);
                }}
                onResizeStop={(_e: any, _dir: any, ref: any, _delta: any, pos: any) =>
                  handleAssinaturaDragResizeStop(pos.x, pos.y, ref.offsetWidth, ref.offsetHeight)
                }
                className="doc-assinatura-livre pointer-events-auto border-2 border-dashed border-fuchsia-500 bg-fuchsia-500/5 flex flex-col items-center justify-end text-center cursor-move z-10 overflow-hidden"
              >
                {currentEmpresa?.assinatura_url && (
                  <img
                    src={currentEmpresa.assinatura_url}
                    alt="Assinatura da Empresa"
                    className="min-h-0 flex-1 max-h-full max-w-full object-contain pointer-events-none"
                  />
                )}
                <div className="signature-line w-4/5 border-t border-slate-900 my-1 pointer-events-none shrink-0"></div>
                <p className="text-[10px] font-bold text-slate-900 uppercase pointer-events-none shrink-0">
                  {currentEmpresa?.nome_fantasia ||
                    currentEmpresa?.razao_social ||
                    'Assinatura Autorizada'}
                </p>
              </Rnd>
            )}

            {assinaturaConfig && !isPosicionandoAssinatura && (
              <div
                className="doc-assinatura-livre absolute flex flex-col items-center justify-end text-center overflow-hidden"
                style={estiloAssinaturaMm(assinaturaConfig, orientation, margens)}
              >
                {currentEmpresa?.assinatura_url && (
                  <img
                    src={currentEmpresa.assinatura_url}
                    alt="Assinatura da Empresa"
                    className="min-h-0 flex-1 max-h-full max-w-full object-contain"
                  />
                )}
                <div className="signature-line w-4/5 border-t border-slate-900 my-1 shrink-0"></div>
                <p className="text-[10px] font-bold text-slate-900 uppercase shrink-0">
                  {currentEmpresa?.nome_fantasia ||
                    currentEmpresa?.razao_social ||
                    'Assinatura Autorizada'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
    </>
  );
};
