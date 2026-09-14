import { useEffect, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import {
  avisoDeCadastrosJaEnviado,
  getCadastrosIncompletos,
} from '../services/cadastrosIncompletosService';
import { createNotificacao } from '../services/notificacoesService';
import { montarAvisoCadastrosIncompletos } from '../utils/cadastrosIncompletos';
import { tenantDeEscrita } from '../utils/tenant';

/**
 * Avisa o admin responsável quando há cadastro de usuário pela metade.
 *
 * Um cadastro nasce em dois lugares — a credencial no Auth e o perfil no app — e nenhum dos
 * dois avisa quando o outro não acontece. `empresa.eras@gmail.com` autenticou 28 dias sem
 * perfil, e dois convites de 11/09/2026 ficaram sem confirmação sem ninguém saber. Nos dois
 * casos o sistema tinha a informação; faltava alguém perguntar.
 *
 * Quem recebe o aviso é **o admin da empresa daquele cadastro**, e isso não é decidido aqui:
 * a RPC `listar_cadastros_incompletos()` só devolve o que o chamador pode ver. Um admin
 * recebe o aviso dos cadastros da própria empresa; o super_admin, de todos. Um `funcionario`
 * roda este hook e recebe lista vazia — não há aviso a dar nem permissão a checar do lado
 * do cliente.
 */
export function useAvisoCadastrosIncompletos() {
  const { state } = useAppContext();
  /**
   * Uma verificação por sessão do app, não uma a cada render.
   *
   * O ref é por montagem, e este hook é montado uma vez só (no `Layout`) — ao contrário do
   * `useNotifications`, que o `Topbar` e o `NotificationCenter` montam ao mesmo tempo e por
   * isso precisou de um `Set` de módulo. Se algum dia este for montado em dois lugares,
   * essa é a primeira coisa a mudar.
   */
  const jaVerificou = useRef(false);

  useEffect(() => {
    const usuarioId = state.user?.id;
    const nivel = state.user?.nivel;
    if (!usuarioId || !state.isOnline || jaVerificou.current) return;
    // Só admin e super_admin têm o que fazer com este aviso. A checagem que vale é a da
    // RPC, no servidor; esta aqui só evita uma ida ao banco por carregamento de quem não
    // receberia nada.
    if (nivel !== 'admin' && nivel !== 'super_admin') return;

    const tenantId = tenantDeEscrita(state.empresaSelecionada, state.user?.tenant_id);
    if (!tenantId) return; // notificação precisa de dono — sem empresa, não nasce

    jaVerificou.current = true;

    const verificar = async () => {
      try {
        const cadastros = await getCadastrosIncompletos(state.isOnline);
        const aviso = montarAvisoCadastrosIncompletos(cadastros);
        if (!aviso) return;

        if (await avisoDeCadastrosJaEnviado(state.isOnline, usuarioId, aviso.mensagem)) return;

        await createNotificacao(
          {
            usuario_id: usuarioId,
            tenant_id: tenantId,
            titulo: aviso.titulo,
            mensagem: aviso.mensagem,
            tipo: 'alerta',
            lida: false,
            link: '/configuracoes',
          },
          state.isOnline,
        );
      } catch (e) {
        // Um aviso que não pôde ser dado não pode derrubar o carregamento do app: as
        // pendências continuam visíveis em Configurações → Usuários, que é a superfície
        // durável. A notificação é o toque no ombro, não o registro.
        console.warn('Não foi possível verificar os cadastros de usuário incompletos:', e);
      }
    };

    verificar();
  }, [state.user?.id, state.user?.nivel, state.user?.tenant_id, state.isOnline, state.empresaSelecionada]);
}
