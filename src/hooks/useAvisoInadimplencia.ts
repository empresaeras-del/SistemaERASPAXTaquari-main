import { useEffect, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { getAssociados } from '../services/associadosService';
import { getParcelasReceber, getReceitas } from '../services/financeiroService';
import { avisoJaEnviado, createNotificacao } from '../services/notificacoesService';
import {
  TITULO_AVISO_INADIMPLENCIA,
  associadosComParcelasVencidas,
  montarAvisoInadimplencia,
} from '../utils/inadimplencia';
// `dataLocalISO` nasceu no módulo de cobrança automática, onde unificou as duas formas de
// datar que o projeto tinha. É dela que vem o dia aqui — não uma segunda cópia da conta.
import { dataLocalISO } from '../utils/cobrancaAutomatica';
import { tenantDeEscrita } from '../utils/tenant';

/**
 * Avisa o administrador quando associados ativos acumulam parcelas vencidas.
 *
 * **Substitui `useBackgroundChecks`, que gravava em vez de avisar.** Aquela rotina rodava
 * no carregamento da aplicação, para todo operador, e mudava o status do associado para
 * `inadimplente` direto no cadastro — sem confirmação, sem notificação, sem linha de
 * auditoria dizendo que fora o sistema, e sem caminho de volta quando o associado pagava.
 * O operador descobria ao abrir o cadastro. Como vários operadores abrem o sistema ao mesmo
 * tempo, a gravação ainda acontecia em concorrência.
 *
 * A regra de negócio é legítima; o que estava errado era ela ser executada sem ninguém no
 * circuito. Marcar um cliente como inadimplente é decisão de cobrança — quem decide é o
 * administrador, na tela de Associados, onde o seletor de status já existe.
 *
 * Três decisões valem como regra:
 *
 * - **Este hook não escreve em `associados`.** Só cria notificação. Detectar e gravar são
 *   passos separados (`utils/inadimplencia.ts` decide **quem**), a mesma divisão da
 *   cobrança automática de atendimento e requisição.
 * - **Só admin e super_admin recebem.** Um funcionário não tem o que fazer com este aviso,
 *   e enchê-lo de alerta que ele não pode resolver é como se aprende a não ler o aviso.
 * - **Uma verificação por sessão**, pelo `ref`, como em `useAvisoCadastrosIncompletos`.
 *   Este hook é montado uma vez só, no `Layout`; se algum dia for montado em dois lugares,
 *   essa é a primeira coisa a mudar.
 */
export function useAvisoInadimplencia() {
  const { state } = useAppContext();
  const jaVerificou = useRef(false);

  useEffect(() => {
    const usuarioId = state.user?.id;
    const nivel = state.user?.nivel;
    if (!usuarioId || !state.isOnline || jaVerificou.current) return;
    if (nivel !== 'admin' && nivel !== 'super_admin') return;

    const tenantId = tenantDeEscrita(state.empresaSelecionada, state.user?.tenant_id);
    if (!tenantId) return; // notificação precisa de dono — sem empresa, não nasce

    jaVerificou.current = true;

    const verificar = async () => {
      try {
        // As receitas entram para o dono da parcela sair de `associado_id`, e não do CPF:
        // `parcelas_receber` não tem vínculo direto com o associado. A rotina antiga casava
        // só por CPF e dependia de os dois lados estarem gravados no mesmo formato.
        const [associados, parcelas, receitas] = await Promise.all([
          getAssociados(state.isOnline, tenantId),
          getParcelasReceber(state.isOnline, tenantId),
          getReceitas(state.isOnline, tenantId),
        ]);

        const candidatos = associadosComParcelasVencidas({
          associados,
          parcelas,
          receitas,
          // O dia vem do relógio local, nunca de `toISOString()` — às 21h em UTC-3 o UTC já
          // é amanhã, e a parcela que vence amanhã passaria a contar como vencida hoje.
          hoje: dataLocalISO(new Date()),
        });

        const aviso = montarAvisoInadimplencia(candidatos);
        if (!aviso) return;

        if (await avisoJaEnviado(state.isOnline, usuarioId, TITULO_AVISO_INADIMPLENCIA, aviso.mensagem))
          return;

        await createNotificacao(
          {
            usuario_id: usuarioId,
            tenant_id: tenantId,
            titulo: aviso.titulo,
            mensagem: aviso.mensagem,
            tipo: 'alerta',
            lida: false,
            link: '/associados',
          },
          state.isOnline,
        );
      } catch (e) {
        // Um aviso que não pôde ser dado não derruba o carregamento do app: as parcelas
        // vencidas continuam visíveis em Contas a Receber, que é a superfície durável.
        console.warn('Não foi possível verificar as parcelas vencidas dos associados:', e);
      }
    };

    verificar();
  }, [
    state.user?.id,
    state.user?.nivel,
    state.user?.tenant_id,
    state.isOnline,
    state.empresaSelecionada,
  ]);
}
