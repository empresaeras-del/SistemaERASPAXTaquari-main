import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  GraduationCap, 
  Search, 
  BookOpen, 
  Users, 
  FileText, 
  HeartHandshake, 
  DollarSign, 
  Layers, 
  Building2, 
  Package, 
  ShieldAlert, 
  Settings, 
  HelpCircle, 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  ExternalLink, 
  ChevronRight, 
  ChevronDown, 
  Lightbulb, 
  Info, 
  AlertTriangle, 
  Zap, 
  Wifi, 
  WifiOff, 
  Printer, 
  Clock, 
  ShieldCheck, 
  FileSpreadsheet, 
  Share2, 
  Smartphone,
  Check,
  Bookmark
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface StepItem {
  titulo: string;
  descricao: string;
  detalhes?: string[];
  destaque?: string;
}

interface TutorialTopic {
  id: string;
  categoriaId: string;
  titulo: string;
  subtitulo: string;
  icone: React.ElementType;
  cor: string;
  rotaPrincipal?: string;
  tempoLeitura: string;
  resumo: string;
  passos: StepItem[];
  dicasDeOuro?: string[];
  alertas?: string[];
  termosChave: string[];
}

interface CategoriaTutorial {
  id: string;
  nome: string;
  descricao: string;
  icone: React.ElementType;
  cor: string;
}

const CATEGORIAS: CategoriaTutorial[] = [
  { id: 'todas', nome: 'Todos os Tópicos', descricao: 'Visão completa de todos os módulos', icone: BookOpen, cor: 'from-blue-600 to-indigo-600' },
  { id: 'primeiros-passos', nome: 'Primeiros Passos', descricao: 'Acesso, layout, navegação e modo offline', icone: Zap, cor: 'from-amber-500 to-orange-500' },
  { id: 'associados', nome: 'Associados & Contratos', descricao: 'Cadastros, dependentes e planos', icone: Users, cor: 'from-blue-600 to-cyan-600' },
  { id: 'atendimentos', nome: 'Atendimentos Funerários', descricao: 'Óbitos, ordens de serviço e acolhimento', icone: HeartHandshake, cor: 'from-rose-500 to-pink-600' },
  { id: 'convenios', nome: 'Rede & Guias de Convênio', descricao: 'Requisições, médicos e faturamentos', icone: Building2, cor: 'from-emerald-500 to-teal-600' },
  { id: 'financeiro', nome: 'Financeiro & Caixas', descricao: 'Mensalidades, pagamentos, PDV e sangrias', icone: DollarSign, cor: 'from-violet-600 to-purple-600' },
  { id: 'estoque', nome: 'Itens Funerários / Estoque', descricao: 'Catálogo de urnas e movimentações', icone: Package, cor: 'from-amber-600 to-yellow-600' },
  { id: 'configuracoes', nome: 'Configurações & Auditoria', descricao: 'Modelos de documentos, usuários e logs', icone: Settings, cor: 'from-slate-600 to-gray-700' },
  { id: 'faq', nome: 'Perguntas Frequentes (FAQ)', descricao: 'Dúvidas comuns e soluções rápidas', icone: HelpCircle, cor: 'from-indigo-500 to-blue-500' }
];

const TUTORIAIS: TutorialTopic[] = [
  {
    id: 'visao-geral-navegacao',
    categoriaId: 'primeiros-passos',
    titulo: 'Estrutura, Navegação & Acesso ao Sistema',
    subtitulo: 'Como se movimentar com rapidez e segurança pelo ERAS PAX',
    icone: Zap,
    cor: 'blue',
    rotaPrincipal: '/',
    tempoLeitura: '3 min',
    resumo: 'Aprenda os conceitos básicos da interface, uso do menu lateral retrátil, atalhos rápidos e alternância de temas.',
    passos: [
      {
        titulo: '1. Menu Lateral e Recolhimento',
        descricao: 'Utilize o menu lateral esquerdo para navegar entre os módulos. Você pode recolher o menu no botão inferior para ganhar mais espaço de visualização na tela.',
        detalhes: [
          'Os módulos com submenu (ex: Associados, Financeiro, Credenciados) abrem opções detalhadas ao clique.',
          'Arraste os itens do menu para reordenar de acordo com a sua preferência diária.'
        ]
      },
      {
        titulo: '2. Alternância de Empresa (Multi-tenant)',
        descricao: 'No topo da tela, verifique a empresa ativa com a qual você está operando. Operadores Super Admin podem trocar de empresa a qualquer momento.',
        detalhes: [
          'Todos os cadastros, parcelas e atendimentos ficam isolados por empresa com total segurança.'
        ]
      },
      {
        titulo: '3. Tema Escuro & Modo Tela Cheia',
        descricao: 'No canto superior direito, clique no ícone de Sol/Lua para alternar entre os temas Claro e Escuro, e no ícone de ampliação para modo tela cheia.'
      }
    ],
    dicasDeOuro: [
      'Pressione a tecla ESC a qualquer momento para fechar modais e janelas sobrepostas.',
      'O sistema salva automaticamente suas preferências de ordem de menu no seu navegador.'
    ],
    termosChave: ['menu', 'sidebar', 'tema', 'empresa', 'acesso', 'navegacao', 'atalhos']
  },
  {
    id: 'sincronizacao-offline',
    categoriaId: 'primeiros-passos',
    titulo: 'Modo Offline & Sincronização Inteligente',
    subtitulo: 'Como o ERAS funciona mesmo quando a internet cai',
    icone: Wifi,
    cor: 'amber',
    tempoLeitura: '4 min',
    resumo: 'Entenda como o banco de dados local (IndexedDB) protege sua operação durante quedas de conexão.',
    passos: [
      {
        titulo: '1. Sincronização Automática da Base',
        descricao: 'Sempre que você estiver conectado, o sistema mantém uma cópia atualizada de segurança no seu computador.',
        detalhes: [
          'No topo da tela, o botão verde "Base Offline" indica a data e hora do último espelhamento seguro.',
          'Você pode clicar em "Base Offline" para forçar uma atualização manual a qualquer momento.'
        ]
      },
      {
        titulo: '2. Operando em Modo Offline (Read-Only)',
        descricao: 'Se a internet oscilar ou cair, o sistema entra em modo de segurança protegido:',
        detalhes: [
          'Você continua consultando associados, mensalidades, contratos e telefones normalmente.',
          'Ações de alteração e exclusão ficam temporariamente protegidas para evitar conflitos de dados até o retorno da rede.'
        ]
      }
    ],
    dicasDeOuro: [
      'Recomenda-se realizar uma sincronização matinal ao iniciar a rotina para garantir que toda a base local esteja 100% atualizada.'
    ],
    termosChave: ['offline', 'sync', 'sincronizacao', 'internet', 'queda', 'indexeddb', 'conexao']
  },
  {
    id: 'cadastro-associados-dependentes',
    categoriaId: 'associados',
    titulo: 'Cadastro Completo de Associados & Dependentes',
    subtitulo: 'Passo a passo para cadastrar titulares, famílias e emitir carteirinhas',
    icone: Users,
    cor: 'cyan',
    rotaPrincipal: '/associados',
    tempoLeitura: '5 min',
    resumo: 'Guia definitivo para inclusão de novos titulares, preenchimento de endereço por CEP, dependentes com parentesco e cálculo de carências.',
    passos: [
      {
        titulo: '1. Iniciar Novo Cadastro',
        descricao: 'Acesse o menu "Associados" > "Lista de Associados" e clique no botão superior "+ Novo Associado".',
        detalhes: [
          'Preencha o Nome Completo, CPF, RG e Data de Nascimento do Titular.',
          'Ao digitar o CEP, os dados de Logradouro, Bairro e Cidade são autopreenchidos.'
        ]
      },
      {
        titulo: '2. Inclusão de Dependentes',
        descricao: 'Na aba "Dependentes", clique em "+ Adicionar Dependente" para cada membro da família:',
        detalhes: [
          'Informe o Nome, Parentesco (Cônjuge, Filho(a), Pai, Mãe, etc.), Data de Nascimento e CPF.',
          'O sistema calcula a idade automaticamente e verifica carências de acordo com as regras do plano.'
        ]
      },
      {
        titulo: '3. Emissão de Carteirinhas e Ficha',
        descricao: 'Após salvar o cadastro, utilize os botões de ação rápida na tabela:',
        detalhes: [
          'Ícone de Carteirinha: Gera a carteirinha em PDF pronta para impressão em papel moeda ou PVC.',
          'Ícone de Impressora: Emite a Ficha Cadastral completa com dados do titular e todos os dependentes.'
        ]
      }
    ],
    dicasDeOuro: [
      'Cadastre sempre o número de WhatsApp com DDD para que o sistema possa enviar mensagens automáticas de felicitações e cobrança com 1 clique.',
      'Associados com pendências financeiras podem ser filtrados instantaneamente na barra superior.'
    ],
    alertas: [
      'O CPF do titular deve ser único por empresa para evitar duplicidade de contratos.'
    ],
    termosChave: ['associado', 'titular', 'dependente', 'carteirinha', 'cadastro', 'cpf', 'ficha cadastral', 'cep']
  },
  {
    id: 'contratos-planos-pax',
    categoriaId: 'associados',
    titulo: 'Gestão de Contratos PAX & Emissão de Carnês',
    subtitulo: 'Como vincular planos funerários, gerar mensalidades e contratos impressos',
    icone: FileText,
    cor: 'blue',
    rotaPrincipal: '/contratos',
    tempoLeitura: '4 min',
    resumo: 'Configuração de vigência, reajustes, geração em lote de parcelas no Contas a Receber e minutas com assinatura.',
    passos: [
      {
        titulo: '1. Criação do Contrato',
        descricao: 'Acesse "Associados" > "Contratos" ou crie diretamente a partir do cadastro do associado:',
        detalhes: [
          'Selecione o Plano PAX (ex: Plano Familiar Ouro, Prata, Individual, etc.).',
          'Defina a data de adesão, dia de vencimento padrão e valor da mensalidade.'
        ]
      },
      {
        titulo: '2. Geração Automática de Parcelas',
        descricao: 'O sistema permite gerar as 12 ou 24 parcelas anuais com 1 clique:',
        detalhes: [
          'As parcelas são lançadas automaticamente no módulo de Contas a Receber.',
          'Você pode imprimir o Carnê Completo ou Folha de Boletos com código de barras/PIX.'
        ]
      },
      {
        titulo: '3. Impressão do Contrato Padrão',
        descricao: 'Clique no botão "Imprimir Contrato" para gerar o documento oficial com todas as cláusulas, direitos funerários e espaço para assinatura das partes.'
      }
    ],
    dicasDeOuro: [
      'Você pode personalizar os termos e cláusulas do contrato no menu "Configurações" > "Documentos Padrões".'
    ],
    termosChave: ['contrato', 'plano pax', 'mensalidade', 'carne', 'vencimento', 'adesao', 'assinatura']
  },
  {
    id: 'atendimentos-obitos-acolhimento',
    categoriaId: 'atendimentos',
    titulo: 'Atendimentos Funerários, Óbitos & Ordens de Serviço',
    subtitulo: 'Procedimento humanizado para abertura de chamado e organização de cortejo',
    icone: HeartHandshake,
    cor: 'rose',
    rotaPrincipal: '/atendimentos',
    tempoLeitura: '6 min',
    resumo: 'Fluxo operacional de acolhimento familiar, checklist de documentação, certidão de óbito, escolha de urna e fechamento.',
    passos: [
      {
        titulo: '1. Abertura do Chamado de Atendimento',
        descricao: 'Acesse "Associados" > "Atendimentos" e clique em "+ Novo Atendimento":',
        detalhes: [
          'Busque o titular ou dependente falecido pelo nome ou número de contrato.',
          'O sistema verifica imediatamente o status do plano e a carência contratual.'
        ]
      },
      {
        titulo: '2. Dados do Óbito e Sepultamento',
        descricao: 'Preencha as informações essenciais:',
        detalhes: [
          'Data e Hora do Falecimento, Médico Atestante e CRM.',
          'Local do Velório (Capela Própria, Residência, etc.) e Cemitério/Data do Sepultamento.',
          'Dados do Responsável/Declarante da família com telefone de contato.'
        ]
      },
      {
        titulo: '3. Seleção da Urna & Serviços Adicionais',
        descricao: 'Selecione o modelo de urna funerária inclusa no plano ou upgrade escolhido pela família:',
        detalhes: [
          'Adicione flores, ornamentação, velas, véu, traslados ou paramentos especiais.',
          'O sistema abate automaticamente o saldo da urna do estoque de itens funerários.'
        ]
      },
      {
        titulo: '4. Emissão de Documentos e Ordem de Serviço',
        descricao: 'Gere a Ordem de Serviço para a equipe de campo, Termo de Declaração de Óbito e Autorização de Sepultamento com assinaturas.'
      }
    ],
    dicasDeOuro: [
      'Mantenha sempre os contatos do declarante atualizados para envio da certidão e notas de falecimento.',
      'O atendimento pode ser impresso em formato compacto para o agente funerário de plantão.'
    ],
    termosChave: ['atendimento', 'obito', 'falecimento', 'urna', 'sepultamento', 'ordem de servico', 'velorio', 'declaracao']
  },
  {
    id: 'requisicoes-guias-medicas',
    categoriaId: 'convenios',
    titulo: 'Emissão de Requisições & Guias de Convênio Médico',
    subtitulo: 'Como autorizar consultas e exames com desconto para os associados',
    icone: Building2,
    cor: 'emerald',
    rotaPrincipal: '/requisicoes',
    tempoLeitura: '4 min',
    resumo: 'Emissão ágil de guias para clínicas, laboratórios e dentistas credenciados com controle de faturamento posterior.',
    passos: [
      {
        titulo: '1. Localizar o Beneficiário',
        descricao: 'Acesse "Associados" > "Requisições / Guias" e clique em "+ Nova Guia":',
        detalhes: [
          'Selecione o Associado Titular ou Dependente beneficiário.',
          'O sistema confirma na hora se o associado está em dia com a mensalidade.'
        ]
      },
      {
        titulo: '2. Escolher o Prestador e Procedimento',
        descricao: 'Selecione o Médico/Clínica credenciada e o exame ou consulta desejada:',
        detalhes: [
          'O valor particular, o valor com desconto de associado e o repasse são calculados automaticamente conforme a tabela de procedimentos.'
        ]
      },
      {
        titulo: '3. Impressão da Guia de Encaminhamento',
        descricao: 'Imprima a Guia Oficial com número de autorização, dados do paciente e carimbo da PAX para que o associado apresente diretamente na clínica.'
      }
    ],
    dicasDeOuro: [
      'Todas as guias emitidas entram automaticamente no lote de conciliação de faturamento do credenciado no final do mês.'
    ],
    termosChave: ['guia', 'requisicao', 'convenio', 'medico', 'clinica', 'exame', 'consulta', 'desconto']
  },
  {
    id: 'contas-receber-pagar-baixas',
    categoriaId: 'financeiro',
    titulo: 'Contas a Receber, Mensalidades & Contas a Pagar',
    subtitulo: 'Rotina financeira diária, quitação de parcelas, emissão de recibos e despesas',
    icone: DollarSign,
    cor: 'purple',
    rotaPrincipal: '/financeiro/contas-a-receber',
    tempoLeitura: '5 min',
    resumo: 'Como receber mensalidades no balcão, emitir recibo térmico 80mm ou A4, aplicar descontos/juros e lançar despesas a pagar.',
    passos: [
      {
        titulo: '1. Localizar Parcela para Recebimento',
        descricao: 'Acesse "Financeiro" > "Contas a Receber":',
        detalhes: [
          'Utilize a barra de pesquisa rápida por Nome do Associado, CPF ou Número do Contrato.',
          'Filtre parcelas vencidas, a vencer hoje ou de meses anteriores.'
        ]
      },
      {
        titulo: '2. Realizar a Baixa do Pagamento',
        descricao: 'Clique no botão "Receber / Baixar":',
        detalhes: [
          'Selecione a forma de pagamento: Dinheiro, PIX, Cartão de Débito, Cartão de Crédito ou Boleto.',
          'Se houver um caixa aberto pelo operador, o valor é creditado automaticamente no terminal de caixa do dia.',
          'Permite quitação parcial, desconto pontual ou acréscimo de juros/multa.'
        ]
      },
      {
        titulo: '3. Emissão do Recibo do Pagador',
        descricao: 'Escolha o formato de recibo desejado:',
        detalhes: [
          'Recibo Térmico (Impressora Não Fiscal 80mm): Ideal para balcão de atendimento rápido.',
          'Recibo Folha A4: Completo com cabeçalho da empresa e assinatura.'
        ]
      },
      {
        titulo: '4. Gestão de Contas a Pagar',
        descricao: 'Em "Financeiro" > "Contas a Pagar", cadastre compromissos (aluguel, fornecedores de urnas, energia, combustível) com data de vencimento e comprovante anexado.'
      }
    ],
    dicasDeOuro: [
      'Aba de Notificações avisa diariamente quantas parcelas vencem hoje para que sua equipe faça a cobrança preventiva.',
      'Você pode estornar uma baixa incorreta caso tenha selecionado a forma de pagamento errada.'
    ],
    termosChave: ['receber', 'pagar', 'baixa', 'recibo', 'pix', 'dinheiro', 'mensalidade', 'desconto', 'juros', 'recibo termico']
  },
  {
    id: 'caixas-pdv-abertura-fechamento',
    categoriaId: 'financeiro',
    titulo: 'Controle de Caixas Diários, PDV, Sangrias & Fechamento',
    subtitulo: 'Como operar o caixa do terminal sem divergências financeiras',
    icone: Layers,
    cor: 'emerald',
    rotaPrincipal: '/caixas',
    tempoLeitura: '5 min',
    resumo: 'Passo a passo da abertura matinal do caixa, reforço de troco (suprimento), retiradas (sangria) e fechamento cego no final do expediente.',
    passos: [
      {
        titulo: '1. Abertura do Lote de Caixa',
        descricao: 'No início do expediente, acesse "Financeiro" > "Caixas / Fluxo de Caixa":',
        detalhes: [
          'Clique em "+ Abrir Caixa".',
          'Selecione o Terminal (ex: Caixa Principal, Balcão 1, Balcão 2).',
          'Informe o Saldo Inicial de Troco (fundo de caixa em dinheiro).'
        ]
      },
      {
        titulo: '2. Movimentações durante o dia',
        descricao: 'Todos os recebimentos em dinheiro, PIX e cartão são vinculados ao caixa aberto:',
        detalhes: [
          'Suprimento: Adicione mais troco quando necessário com justificativa.',
          'Sangria: Registre retiradas de dinheiro para cofre ou pagamentos urgentes de despesas.'
        ]
      },
      {
        titulo: '3. Fechamento e Conferência',
        descricao: 'Ao final do dia, clique em "Fechar Caixa":',
        detalhes: [
          'Conte o dinheiro físico da gaveta e informe os totais apurados.',
          'O sistema gera o Relatório de Fechamento de Caixa com o resumo de cada forma de pagamento (Dinheiro, PIX, Cartão).'
        ]
      }
    ],
    dicasDeOuro: [
      'Nunca compartilhe o mesmo lote de caixa entre operadores diferentes para garantir a rastreabilidade total de valores.'
    ],
    termosChave: ['caixa', 'lote', 'terminal', 'suprimento', 'sangria', 'fechamento', 'troco', 'conferencia']
  },
  {
    id: 'itens-funerarios-estoque-urnas',
    categoriaId: 'estoque',
    titulo: 'Catálogo de Itens Funerários, Urnas & Movimentação',
    subtitulo: 'Controle de saldo, reposição de estoque e baixas automáticas',
    icone: Package,
    cor: 'amber',
    rotaPrincipal: '/itens-funerarios',
    tempoLeitura: '3 min',
    resumo: 'Cadastro de produtos funerários, preços de custo/venda, estoque mínimo e alerta de reposição.',
    passos: [
      {
        titulo: '1. Cadastro de Urnas e Artigos',
        descricao: 'Acesse "Itens Funerários":',
        detalhes: [
          'Cadastre o modelo da urna (Tamanho Adulto, Infantil, Especial, Sextavada, Varão, etc.).',
          'Defina o código de referência, fornecedor e estoque mínimo de segurança.'
        ]
      },
      {
        titulo: '2. Baixa Automática e Entrada de Compras',
        descricao: 'O estoque é atualizado em tempo real:',
        detalhes: [
          'Ao vincular a urna em um Atendimento de Óbito, a saída é registrada automaticamente.',
          'Lance entradas avulsas de novas remessas de fornecedores para manter o saldo físico exato.'
        ]
      }
    ],
    dicasDeOuro: [
      'Monitore os itens destacados em vermelho com estoque abaixo do mínimo para providenciar pedidos antecipados aos fornecedores.'
    ],
    termosChave: ['estoque', 'urna', 'itens funerarios', 'flores', 'saldo', 'reposicao', 'fornecedor']
  },
  {
    id: 'documentos-modelos-auditoria',
    categoriaId: 'configuracoes',
    titulo: 'Documentos Padrões, Minutas & Ata de Ocorrências',
    subtitulo: 'Personalização de contratos com tags e rastreabilidade total de segurança',
    icone: ShieldAlert,
    cor: 'slate',
    rotaPrincipal: '/documentos',
    tempoLeitura: '4 min',
    resumo: 'Uso de tags dinâmicas para gerar contratos automáticos e consulta detalhada da auditoria de ações.',
    passos: [
      {
        titulo: '1. Modelos de Documentos com Tags Dinâmicas',
        descricao: 'Em "Configurações" > "Documentos Padrões", crie e edite minutas utilizando as tags do sistema:',
        detalhes: [
          '{{NOME_ASSOCIADO}} -> Insere o nome completo do titular.',
          '{{CPF_ASSOCIADO}} -> Insere o CPF formatado.',
          '{{NUMERO_CONTRATO}} -> Insere o número do contrato.',
          '{{NOME_EMPRESA}} -> Insere a razão social ou nome fantasia da PAX.'
        ]
      },
      {
        titulo: '2. Consulta à Ata de Ocorrências (Auditoria)',
        descricao: 'Em "Ata de Ocorrências", consulte o registro histórico completo:',
        detalhes: [
          'Rastreia quem cadastrou, alterou ou excluiu qualquer associado, parcela ou caixa.',
          'Exibe data, hora exata, IP e dados antes/depois da modificação para governança corporativa.'
        ]
      }
    ],
    dicasDeOuro: [
      'Nunca compartilhe senhas de usuários individuais para que o relatório de auditoria identifique com precisão as ações operacionais.'
    ],
    termosChave: ['documentos', 'tags', 'minuta', 'auditoria', 'logs', 'seguranca', 'ocorrencias']
  }
];

const FAQS = [
  {
    pergunta: 'Como faço para parabenizar os aniversariantes do mês?',
    resposta: 'Na tela inicial (Dashboard) ou ao abrir o sistema, clique no botão de Informações ou no banner de Aniversariantes do Mês. Na aba "Aniversariantes", você pode filtrar por quem faz aniversário HOJE e clicar no botão verde "Parabenizar" para abrir o WhatsApp com mensagem personalizada preenchida.'
  },
  {
    pergunta: 'O que fazer se a internet cair enquanto estou atendendo um cliente?',
    resposta: 'Não se preocupe! O ERAS PAX possui arquitetura Offline-First (IndexedDB). Você continua pesquisando associados, checando dados de contratos e telefones de dependentes normalmente. Quando a internet voltar, tudo se sincroniza com a nuvem.'
  },
  {
    pergunta: 'Como emitir uma 2ª via de carteirinha de dependente?',
    resposta: 'Acesse o menu "Associados" > "Lista de Associados", localize o titular e abra os detalhes. Na seção de dependentes, clique no ícone de Carteirinha ao lado do nome do dependente para gerar a versão individual para impressão.'
  },
  {
    pergunta: 'Como cancelar ou estornar um recebimento lançado errado no caixa?',
    resposta: 'Acesse "Financeiro" > "Contas a Receber", localize a parcela que foi baixada indevidamente, clique nos três pontos de opções da parcela e selecione "Estornar Baixa". A parcela retornará ao status pendente e o valor será deduzido do relatório de caixa.'
  },
  {
    pergunta: 'Qual a diferença entre os níveis de usuário (Super Admin, Admin, Gerente e Funcionário)?',
    resposta: 'Super Admin: Acesso total a todas as empresas do grupo, faturamento e configurações avançadas.\nAdmin: Gerencia usuários, configurações e relatórios da sua empresa.\nGerente: Tem acesso a relatórios gerenciais, cadastros e aprovações financeiras.\nFuncionário: Focado nas operações do dia a dia (cadastros, atendimentos, emissão de guias e recebimentos), com restrições de exclusão de dados críticos.'
  },
  {
    pergunta: 'Como imprimir o recibo de pagamento em impressora térmica (bobina 80mm)?',
    resposta: 'Ao realizar a baixa de uma parcela ou ao clicar no botão "Recibo" de uma mensalidade paga, escolha a opção "Recibo Térmico (80mm)". O sistema abrirá a janela de impressão compacta pronta para sua impressora não-fiscal.'
  }
];

export const TutorialPage: React.FC = () => {
  const navigate = useNavigate();
  const [busca, setBusca] = useState('');
  const [categoriaAtiva, setCategoriaAtiva] = useState('todas');
  const [topicoSelecionado, setTopicoSelecionado] = useState<TutorialTopic | null>(TUTORIAIS[0]);
  const [faqAberto, setFaqAberto] = useState<number | null>(null);
  const [topicosConcluidos, setTopicosConcluidos] = useState<string[]>(() => {
    try {
      const salvo = localStorage.getItem('eras_tutorial_concluidos');
      return salvo ? JSON.parse(salvo) : [];
    } catch {
      return [];
    }
  });

  const toggleConcluido = (id: string) => {
    setTopicosConcluidos(prev => {
      const novo = prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id];
      try {
        localStorage.setItem('eras_tutorial_concluidos', JSON.stringify(novo));
      } catch (e) {
        console.error(e);
      }
      return novo;
    });
  };

  const tutoriaisFiltrados = useMemo(() => {
    return TUTORIAIS.filter(item => {
      const matchCategoria = categoriaAtiva === 'todas' || item.categoriaId === categoriaAtiva;
      if (!matchCategoria) return false;

      if (busca.trim()) {
        const termo = busca.toLowerCase();
        const matchTitulo = item.titulo.toLowerCase().includes(termo);
        const matchSub = item.subtitulo.toLowerCase().includes(termo);
        const matchResumo = item.resumo.toLowerCase().includes(termo);
        const matchTermos = item.termosChave.some(t => t.toLowerCase().includes(termo));
        const matchPassos = item.passos.some(p => p.titulo.toLowerCase().includes(termo) || p.descricao.toLowerCase().includes(termo));
        return matchTitulo || matchSub || matchResumo || matchTermos || matchPassos;
      }

      return true;
    });
  }, [busca, categoriaAtiva]);

  const faqsFiltrados = useMemo(() => {
    if (!busca.trim()) return FAQS;
    const termo = busca.toLowerCase();
    return FAQS.filter(f => f.pergunta.toLowerCase().includes(termo) || f.resposta.toLowerCase().includes(termo));
  }, [busca]);

  const progressoPercentual = Math.round((topicosConcluidos.length / TUTORIAIS.length) * 100);

  return (
    <div className="space-y-8 pb-16">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-10 shadow-2xl border border-blue-500/20">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-12 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-xs font-semibold uppercase tracking-wider backdrop-blur-md">
              <GraduationCap className="w-4 h-4 text-blue-400" />
              Central de Treinamento & Orientação ao Usuário
            </div>
            
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
              Guia Completo do Sistema <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-300">ERAS PAX</span>
            </h1>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Tudo o que você precisa saber para operar com excelência: associados, atendimentos funerários, contratos, guias de convênio, caixa e finanças.
            </p>

            {/* Barra de Progresso de Leitura */}
            <div className="pt-2 flex items-center gap-3">
              <div className="flex-1 bg-white/10 rounded-full h-2.5 overflow-hidden max-w-xs border border-white/10">
                <div 
                  className="bg-gradient-to-r from-emerald-400 to-teal-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${progressoPercentual}%` }}
                />
              </div>
              <span className="text-xs font-semibold text-slate-300">
                {progressoPercentual}% concluído ({topicosConcluidos.length}/{TUTORIAIS.length} guias)
              </span>
            </div>
          </div>

          {/* Campo de Busca Rápida */}
          <div className="w-full md:w-80 bg-white/10 backdrop-blur-xl p-2 rounded-2xl border border-white/20 shadow-lg">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-300 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar tutorial, dúvida, rota..."
                className="w-full pl-10 pr-4 py-2.5 bg-black/20 hover:bg-black/30 focus:bg-black/40 border border-white/10 rounded-xl text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all"
              />
              {busca && (
                <button
                  onClick={() => setBusca('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Categorias Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {CATEGORIAS.map((cat) => {
          const Icon = cat.icone;
          const isActive = categoriaAtiva === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => {
                setCategoriaAtiva(cat.id);
                if (cat.id !== 'todas' && cat.id !== 'faq') {
                  const primeiro = TUTORIAIS.find(t => t.categoriaId === cat.id);
                  if (primeiro) setTopicoSelecionado(primeiro);
                }
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all duration-200 border ${
                isActive
                  ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/25'
                  : 'bg-bg-surface text-text-subtle hover:text-text-base border-border-default hover:border-blue-500/30'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{cat.nome}</span>
            </button>
          );
        })}
      </div>

      {categoriaAtiva === 'faq' ? (
        /* Seção dedicada de FAQ */
        <div className="space-y-4">
          <div className="bg-bg-surface p-6 rounded-3xl border border-border-default shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-500">
                <HelpCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-text-base">Perguntas Frequentes (FAQ)</h3>
                <p className="text-xs text-text-subtle">Respostas diretas para as dúvidas mais comuns do dia a dia</p>
              </div>
            </div>

            <div className="space-y-3">
              {faqsFiltrados.map((faq, idx) => (
                <div 
                  key={idx}
                  className="border border-border-default rounded-2xl overflow-hidden transition-all bg-bg-base"
                >
                  <button
                    onClick={() => setFaqAberto(faqAberto === idx ? null : idx)}
                    className="w-full p-4 text-left flex items-center justify-between gap-4 font-semibold text-sm sm:text-base text-text-base hover:text-blue-500 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      {faq.pergunta}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-text-subtle transition-transform duration-300 ${faqAberto === idx ? 'rotate-180 text-blue-500' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {faqAberto === idx && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="px-4 pb-4 text-sm text-text-subtle border-t border-border-default/50 pt-3 whitespace-pre-line leading-relaxed"
                      >
                        {faq.resposta}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Layout Principal do Tutorial: Menu Lateral de Tópicos + Painel Detalhado */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Coluna Esquerda: Lista de Tópicos */}
          <div className="lg:col-span-4 space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold uppercase tracking-wider text-text-subtle">
                Manuais Disponíveis ({tutoriaisFiltrados.length})
              </span>
            </div>

            <div className="space-y-2 max-h-[700px] overflow-y-auto pr-1 custom-scrollbar">
              {tutoriaisFiltrados.length === 0 ? (
                <div className="p-8 text-center bg-bg-surface rounded-2xl border border-border-default border-dashed">
                  <BookOpen className="w-8 h-8 text-text-subtle/50 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-text-base">Nenhum tutorial encontrado</p>
                  <p className="text-xs text-text-subtle mt-1">Tente pesquisar por outro termo ou selecione outra categoria.</p>
                </div>
              ) : (
                tutoriaisFiltrados.map((item) => {
                  const Icon = item.icone;
                  const isSelected = topicoSelecionado?.id === item.id;
                  const isConcluido = topicosConcluidos.includes(item.id);

                  return (
                    <div
                      key={item.id}
                      onClick={() => setTopicoSelecionado(item)}
                      className={`p-4 rounded-2xl cursor-pointer transition-all duration-200 border relative overflow-hidden flex flex-col gap-2 ${
                        isSelected
                          ? 'bg-blue-600/10 border-blue-500/50 shadow-md ring-1 ring-blue-500/30'
                          : 'bg-bg-surface border-border-default hover:border-blue-500/30 hover:bg-bg-hover'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={`p-2.5 rounded-xl shrink-0 ${
                            isSelected 
                              ? 'bg-blue-600 text-white' 
                              : 'bg-bg-subtle text-text-subtle'
                          }`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className={`text-sm font-bold leading-tight ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-text-base'}`}>
                              {item.titulo}
                            </h4>
                            <span className="text-[11px] text-text-subtle flex items-center gap-1.5 mt-1">
                              <Clock className="w-3 h-3" /> {item.tempoLeitura}
                            </span>
                          </div>
                        </div>

                        {isConcluido && (
                          <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0" title="Manual concluído">
                            <Check className="w-3 h-3 font-black" />
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-text-subtle line-clamp-2 mt-0.5">
                        {item.subtitulo}
                      </p>
                    </div>
                  );
                })
              )}
            </div>

            {/* Banner de Dúvidas Rápidas */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-500/10 to-blue-500/10 border border-indigo-500/20 flex items-center justify-between gap-3">
              <div>
                <h5 className="text-xs font-bold text-text-base">Tem dúvidas pontuais?</h5>
                <p className="text-[11px] text-text-subtle">Consulte nossa seção de Perguntas Frequentes.</p>
              </div>
              <button
                onClick={() => setCategoriaAtiva('faq')}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shrink-0 shadow-sm transition-all"
              >
                Ver FAQ
              </button>
            </div>
          </div>

          {/* Coluna Direita: Conteúdo Detalhado do Tópico Selecionado */}
          <div className="lg:col-span-8">
            {topicoSelecionado ? (
              <motion.div
                key={topicoSelecionado.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="bg-bg-surface rounded-3xl border border-border-default p-6 sm:p-8 shadow-sm space-y-6"
              >
                {/* Header do Tópico */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border-default">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 shadow-inner">
                      <topicoSelecionado.icone className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                          {topicoSelecionado.tempoLeitura} de leitura
                        </span>
                        {topicosConcluidos.includes(topicoSelecionado.id) && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                            <Check className="w-3 h-3" /> Concluído
                          </span>
                        )}
                      </div>
                      <h2 className="text-xl sm:text-2xl font-black text-text-base tracking-tight mt-1">
                        {topicoSelecionado.titulo}
                      </h2>
                      <p className="text-xs sm:text-sm text-text-subtle mt-0.5">
                        {topicoSelecionado.subtitulo}
                      </p>
                    </div>
                  </div>

                  {/* Ações Rápidas no Header */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => toggleConcluido(topicoSelecionado.id)}
                      className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border ${
                        topicosConcluidos.includes(topicoSelecionado.id)
                          ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                          : 'bg-bg-subtle text-text-subtle hover:text-text-base border-border-default'
                      }`}
                      title={topicosConcluidos.includes(topicoSelecionado.id) ? 'Marcar como não lido' : 'Marcar como lido'}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="hidden sm:inline">
                        {topicosConcluidos.includes(topicoSelecionado.id) ? 'Lido' : 'Marcar Lido'}
                      </span>
                    </button>

                    {topicoSelecionado.rotaPrincipal && (
                      <button
                        onClick={() => navigate(topicoSelecionado.rotaPrincipal!)}
                        className="px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-500/20 flex items-center gap-1.5 transition-all active:scale-95"
                      >
                        <span>Ir para a Tela</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Resumo do Tópico */}
                <div className="p-4 rounded-2xl bg-bg-base border border-border-default/80 flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                  <p className="text-xs sm:text-sm text-text-base leading-relaxed">
                    {topicoSelecionado.resumo}
                  </p>
                </div>

                {/* Passos Operacionais */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-text-subtle flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-500" />
                    Passo a Passo Operacional
                  </h3>

                  <div className="space-y-3">
                    {topicoSelecionado.passos.map((passo, pIdx) => (
                      <div 
                        key={pIdx}
                        className="p-4 sm:p-5 rounded-2xl bg-bg-base border border-border-default/60 hover:border-blue-500/30 transition-all space-y-2"
                      >
                        <h4 className="text-sm sm:text-base font-bold text-text-base flex items-center gap-2">
                          {passo.titulo}
                        </h4>
                        <p className="text-xs sm:text-sm text-text-subtle leading-relaxed">
                          {passo.descricao}
                        </p>

                        {passo.detalhes && passo.detalhes.length > 0 && (
                          <ul className="space-y-1.5 pt-2 border-t border-border-default/40 mt-2">
                            {passo.detalhes.map((detalhe, dIdx) => (
                              <li key={dIdx} className="text-xs text-text-base flex items-start gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                                <span>{detalhe}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Dicas de Ouro */}
                {topicoSelecionado.dicasDeOuro && topicoSelecionado.dicasDeOuro.length > 0 && (
                  <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 via-bg-base to-amber-500/5 border border-amber-500/30 space-y-2">
                    <div className="flex items-center gap-2 text-amber-500 font-bold text-sm">
                      <Lightbulb className="w-4 h-4" />
                      <span>Dica de Ouro</span>
                    </div>
                    <ul className="space-y-1.5 text-xs text-text-base">
                      {topicoSelecionado.dicasDeOuro.map((dica, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-amber-500 font-bold">•</span>
                          <span>{dica}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Alertas */}
                {topicoSelecionado.alertas && topicoSelecionado.alertas.length > 0 && (
                  <div className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 space-y-2">
                    <div className="flex items-center gap-2 text-rose-500 font-bold text-sm">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Atenção Importante</span>
                    </div>
                    <ul className="space-y-1.5 text-xs text-rose-400">
                      {topicoSelecionado.alertas.map((alerta, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="font-bold">•</span>
                          <span>{alerta}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Rodapé do Tópico */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-6 border-t border-border-default">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-text-subtle mr-1">Palavras-chave:</span>
                    {topicoSelecionado.termosChave.map((termo, tIdx) => (
                      <span 
                        key={tIdx} 
                        className="px-2 py-0.5 rounded-lg bg-bg-subtle text-[10px] font-medium text-text-subtle border border-border-default"
                      >
                        #{termo}
                      </span>
                    ))}
                  </div>

                  {topicoSelecionado.rotaPrincipal && (
                    <button
                      onClick={() => navigate(topicoSelecionado.rotaPrincipal!)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-500/20 transition-all active:scale-95 ml-auto"
                    >
                      <span>Acessar Módulo Agora</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </motion.div>
            ) : (
              <div className="p-12 text-center bg-bg-surface rounded-3xl border border-border-default flex flex-col items-center justify-center">
                <BookOpen className="w-12 h-12 text-text-subtle/50 mb-3" />
                <h3 className="text-base font-bold text-text-base">Selecione um tópico ao lado</h3>
                <p className="text-xs text-text-subtle mt-1">Escolha qualquer manual para visualizar o passo a passo detalhado.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
