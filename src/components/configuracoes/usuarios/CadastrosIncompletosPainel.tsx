import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Mail, UserPlus, RefreshCw } from 'lucide-react';
import { useAppContext } from '../../../context/AppContext';
import { useToast } from '../../../context/ToastContext';
import {
  criarPerfilDoCadastro,
  getCadastrosIncompletos,
  reenviarConfirmacaoDeEmail,
} from '../../../services/cadastrosIncompletosService';
import {
  CadastroDeUsuario,
  DESCRICAO_PENDENCIA,
  identificacaoDoCadastro,
  ordenarPorGravidade,
  pendenciasDoCadastro,
} from '../../../utils/cadastrosIncompletos';

interface CadastrosIncompletosPainelProps {
  /** Chamado quando uma pendência é resolvida, para a lista de usuários recarregar. */
  onResolvido: () => void;
}

/**
 * O que falta em cada cadastro de usuário, e o botão que resolve.
 *
 * É um painel à parte, e não uma coluna na tabela de usuários, porque o caso mais grave
 * **não está na tabela**: um cadastro sem perfil não existe em `public.users`, então nenhuma
 * linha o representa. Foi assim que `empresa.eras@gmail.com` passou 28 dias invisível — a
 * tela de usuários mostrava tudo certo porque só sabia olhar para onde ele não estava.
 *
 * Carrega os próprios dados (como `CentrosCustoModal`, e ao contrário de
 * `SeletorContaContabil`, que recebe por props): a fonte é uma RPC que nenhuma outra parte
 * da tela usa, e precisa recarregar depois de cada ação daqui.
 */
export const CadastrosIncompletosPainel: React.FC<CadastrosIncompletosPainelProps> = ({
  onResolvido,
}) => {
  const { state } = useAppContext();
  const toast = useToast();
  const [cadastros, setCadastros] = useState<CadastroDeUsuario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [emAndamento, setEmAndamento] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      setCadastros(ordenarPorGravidade(await getCadastrosIncompletos(state.isOnline)));
    } catch (e) {
      // Sem permissão (nível abaixo de admin) ou sem rede: o painel some, em vez de
      // exibir um erro sobre algo que este usuário não teria como resolver.
      console.warn('Não foi possível carregar os cadastros incompletos:', e);
      setCadastros([]);
    } finally {
      setCarregando(false);
    }
  }, [state.isOnline]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const handleReenviar = async (cadastro: CadastroDeUsuario) => {
    setEmAndamento(cadastro.usuario_id);
    try {
      await reenviarConfirmacaoDeEmail(cadastro.email);
      toast.success(`Confirmação reenviada para ${cadastro.email}.`);
    } catch (e: any) {
      toast.error(e?.message || 'Não foi possível reenviar a confirmação.');
    } finally {
      setEmAndamento(null);
    }
  };

  const handleCriarPerfil = async (cadastro: CadastroDeUsuario) => {
    setEmAndamento(cadastro.usuario_id);
    try {
      await criarPerfilDoCadastro(cadastro);
      toast.success(`Perfil de acesso criado para ${identificacaoDoCadastro(cadastro)}.`);
      await carregar();
      onResolvido();
    } catch (e: any) {
      toast.error(e?.message || 'Não foi possível criar o perfil de acesso.');
    } finally {
      setEmAndamento(null);
    }
  };

  if (carregando || cadastros.length === 0) return null;

  return (
    <div className="bg-amber-500/5 border border-amber-500/30 rounded-xl p-4 space-y-3">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-amber-200">
            {cadastros.length === 1
              ? '1 cadastro de usuário está pela metade'
              : `${cadastros.length} cadastros de usuário estão pela metade`}
          </h4>
          <p className="text-sm text-amber-200/70">
            Estes usuários não conseguem usar o sistema como deveriam.
          </p>
        </div>
        <button
          type="button"
          onClick={carregar}
          className="p-1.5 text-amber-300/70 hover:text-amber-200 hover:bg-amber-500/10 rounded-lg transition-colors"
          title="Verificar novamente"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <ul className="space-y-2">
        {cadastros.map((cadastro) => {
          const pendencias = pendenciasDoCadastro(cadastro);
          const ocupado = emAndamento === cadastro.usuario_id;
          return (
            <li
              key={cadastro.usuario_id}
              className="bg-[#101223] border border-[#262A45] rounded-lg p-3 flex flex-col sm:flex-row sm:items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white truncate">
                  {identificacaoDoCadastro(cadastro)}
                  {/* O e-mail só se repete quando NÃO é ele que está identificando a linha:
                      um convite sem nome cai no e-mail, e "fulano@x · fulano@x" é ruído. */}
                  {identificacaoDoCadastro(cadastro) !== cadastro.email && (
                    <span className="text-slate-400 font-normal"> · {cadastro.email}</span>
                  )}
                </p>
                <ul className="mt-1 space-y-0.5">
                  {pendencias.map((p) => (
                    <li key={p} className="text-xs text-slate-400">
                      <span className="inline-flex items-center px-1.5 py-0.5 mr-1.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/25 font-semibold">
                        {DESCRICAO_PENDENCIA[p].rotulo}
                      </span>
                      {DESCRICAO_PENDENCIA[p].comoResolver}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Largura fixa mesmo quando há um botão só: sem isso a coluna de ações dança
                  de linha em linha conforme a pendência de cada cadastro. A largura é a da
                  linha com os DOIS botões — dimensionada pelo caso mais cheio, senão os
                  rótulos quebram justamente onde há mais o que fazer. */}
              <div className="flex items-center gap-2 shrink-0 sm:w-[272px] sm:justify-end">
                {!cadastro.tem_perfil && (
                  <button
                    type="button"
                    disabled={ocupado || !state.isOnline}
                    onClick={() => handleCriarPerfil(cadastro)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#7E4CF3] text-white whitespace-nowrap hover:opacity-90 transition-opacity disabled:opacity-50"
                    title={DESCRICAO_PENDENCIA.perfil_ausente.comoResolver}
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Criar perfil
                  </button>
                )}
                {!cadastro.email_confirmado && (
                  <button
                    type="button"
                    disabled={ocupado || !state.isOnline}
                    onClick={() => handleReenviar(cadastro)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#262A45] text-slate-200 whitespace-nowrap hover:bg-white/5 transition-colors disabled:opacity-50"
                    title={DESCRICAO_PENDENCIA.email_nao_confirmado.comoResolver}
                  >
                    <Mail className="w-3.5 h-3.5" />
                    Reenviar convite
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
