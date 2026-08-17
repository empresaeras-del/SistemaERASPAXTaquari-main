const fs = require('fs');

let file = 'src/pages/Associados.tsx';
let code = fs.readFileSync(file, 'utf8');

const tabsRegex = /\{\/\* Step 1 \*\/\}[\s\S]*?\{\/\* Step 4 \*\/\}[\s\S]*?<\/div>/;

const newTabs = `{/* Step 1 */}
                    <div
                      className={\`flex flex-col items-center flex-1 \${activeTab === "principal" || activeTab === "dependentes" || activeTab === "contratos" || activeTab === "mensalidades" || activeTab === "documentos" ? "text-[#7E4CF3]" : "text-slate-500"}\`}
                    >
                      <div
                        className={\`w-8 h-8 rounded-full flex items-center justify-center font-bold mb-2 transition-colors \${activeTab === "principal" || activeTab === "dependentes" || activeTab === "contratos" || activeTab === "mensalidades" || activeTab === "documentos" ? "bg-[#7E4CF3] text-white shadow-[0_0_10px_rgba(126,76,243,0.5)]" : "bg-[#222542] text-slate-400"}\`}
                      >
                        1
                      </div>
                      <span className="text-xs font-medium">Dados Básicos</span>
                    </div>

                    <div
                      className={\`w-16 h-0.5 mx-2 \${activeTab === "dependentes" || activeTab === "contratos" || activeTab === "mensalidades" || activeTab === "documentos" ? "bg-[#7E4CF3]" : "bg-[#262A45]"}\`}
                    ></div>

                    {/* Step 2 */}
                    <div
                      className={\`flex flex-col items-center flex-1 \${activeTab === "dependentes" || activeTab === "contratos" || activeTab === "mensalidades" || activeTab === "documentos" ? "text-[#7E4CF3]" : "text-slate-500"}\`}
                    >
                      <div
                        className={\`w-8 h-8 rounded-full flex items-center justify-center font-bold mb-2 transition-colors \${activeTab === "dependentes" || activeTab === "contratos" || activeTab === "mensalidades" || activeTab === "documentos" ? "bg-[#7E4CF3] text-white shadow-[0_0_10px_rgba(126,76,243,0.5)]" : "bg-[#222542] text-slate-400"}\`}
                      >
                        2
                      </div>
                      <span className="text-xs font-medium">Dependentes</span>
                    </div>

                    <div
                      className={\`w-16 h-0.5 mx-2 \${activeTab === "contratos" || activeTab === "mensalidades" || activeTab === "documentos" ? "bg-[#7E4CF3]" : "bg-[#262A45]"}\`}
                    ></div>

                    {/* Step 3 */}
                    <div
                      className={\`flex flex-col items-center flex-1 \${activeTab === "contratos" || activeTab === "mensalidades" || activeTab === "documentos" ? "text-[#7E4CF3]" : "text-slate-500"}\`}
                    >
                      <div
                        className={\`w-8 h-8 rounded-full flex items-center justify-center font-bold mb-2 transition-colors \${activeTab === "contratos" || activeTab === "mensalidades" || activeTab === "documentos" ? "bg-[#7E4CF3] text-white shadow-[0_0_10px_rgba(126,76,243,0.5)]" : "bg-[#222542] text-slate-400"}\`}
                      >
                        3
                      </div>
                      <span className="text-xs font-medium">Contrato</span>
                    </div>

                    <div
                      className={\`w-16 h-0.5 mx-2 \${activeTab === "mensalidades" || activeTab === "documentos" ? "bg-[#7E4CF3]" : "bg-[#262A45]"}\`}
                    ></div>

                    {/* Step 4 */}
                    <div
                      className={\`flex flex-col items-center flex-1 \${activeTab === "mensalidades" || activeTab === "documentos" ? "text-[#7E4CF3]" : "text-slate-500"}\`}
                    >
                      <div
                        className={\`w-8 h-8 rounded-full flex items-center justify-center font-bold mb-2 transition-colors \${activeTab === "mensalidades" || activeTab === "documentos" ? "bg-[#7E4CF3] text-white shadow-[0_0_10px_rgba(126,76,243,0.5)]" : "bg-[#222542] text-slate-400"}\`}
                      >
                        4
                      </div>
                      <span className="text-xs font-medium">Mensalidades</span>
                    </div>

                    <div
                      className={\`w-16 h-0.5 mx-2 \${activeTab === "documentos" ? "bg-[#7E4CF3]" : "bg-[#262A45]"}\`}
                    ></div>

                    {/* Step 5 */}
                    <div
                      className={\`flex flex-col items-center flex-1 \${activeTab === "documentos" ? "text-[#7E4CF3]" : "text-slate-500"}\`}
                    >
                      <div
                        className={\`w-8 h-8 rounded-full flex items-center justify-center font-bold mb-2 transition-colors \${activeTab === "documentos" ? "bg-[#7E4CF3] text-white shadow-[0_0_10px_rgba(126,76,243,0.5)]" : "bg-[#222542] text-slate-400"}\`}
                      >
                        5
                      </div>
                      <span className="text-xs font-medium">Documentos</span>
                    </div>`;

code = code.replace(tabsRegex, newTabs);

fs.writeFileSync(file, code);
