import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { KeyRound, X, Eye, EyeOff, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppContext } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { alterarPropriaSenha } from '../../services/usuariosService';
import {
  validarTrocaDeSenha,
  forcaDaSenha,
  dicaDeForca,
  ForcaSenha,
  TAMANHO_MINIMO_SENHA
} from '../../utils/senhaUsuario';

interface AlterarSenhaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CORES_DA_FORCA: Record<ForcaSenha, { barra: string; texto: string; passos: number }> = {
  fraca: { barra: 'bg-rose-500', texto: 'text-rose-400', passos: 1 },
  media: { barra: 'bg-amber-400', texto: 'text-amber-400', passos: 2 },
  forte: { barra: 'bg-emerald-500', texto: 'text-emerald-400', passos: 3 }
};

export const AlterarSenhaModal: React.FC<AlterarSenhaModalProps> = ({ isOpen, onClose }) => {
  const { state } = useAppContext();
  const { supabaseUser } = useAuth();
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [mostrarSenhas, setMostrarSenhas] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  if (!isOpen) return null;

  // O e-mail vem do usuário do Auth, não do perfil em `public.users`: é contra
  // `auth.users` que a conferência da senha atual é feita, e são duas tabelas
  // diferentes que podem, em tese, discordar.
  const emailDaConta = supabaseUser?.email || state.user?.email || '';

  const fechar = () => {
    if (salvando) return;
    setSenhaAtual('');
    setNovaSenha('');
    setConfirmacao('');
    setMostrarSenhas(false);
    setErro(null);
    onClose();
  };

  const validacao = validarTrocaDeSenha({ senhaAtual, novaSenha, confirmacao });
  const forca = forcaDaSenha(novaSenha);
  const cores = CORES_DA_FORCA[forca];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (!validacao.ok) {
      setErro(validacao.mensagem);
      return;
    }

    setSalvando(true);
    try {
      await alterarPropriaSenha(
        { email: emailDaConta, senhaAtual, novaSenha, confirmacao },
        state.isOnline
      );
      toast.success('Senha alterada com sucesso. Use a nova senha no próximo acesso.');
      fechar();
    } catch (err: unknown) {
      // A recusa do servidor chega inteira: um "erro ao alterar" genérico não diz se o
      // problema foi a senha atual, a política de senha ou a conexão.
      setErro(err instanceof Error ? err.message : 'Não foi possível alterar a senha.');
    } finally {
      setSalvando(false);
    }
  };

  const campoClasse =
    'w-full px-4 py-2.5 pr-11 bg-bg-base border border-border-default rounded-xl text-text-base ' +
    'placeholder:text-text-subtle/70 focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 ' +
    'focus:border-[#3B82F6] transition-all';

  const campos: Array<{
    id: string;
    rotulo: string;
    valor: string;
    onChange: (v: string) => void;
    placeholder: string;
    autoComplete: string;
  }> = [
    {
      id: 'senha-atual',
      rotulo: 'Senha atual',
      valor: senhaAtual,
      onChange: setSenhaAtual,
      placeholder: 'A senha que você usa hoje',
      autoComplete: 'current-password'
    },
    {
      id: 'senha-nova',
      rotulo: 'Nova senha',
      valor: novaSenha,
      onChange: setNovaSenha,
      placeholder: `Mínimo de ${TAMANHO_MINIMO_SENHA} caracteres`,
      autoComplete: 'new-password'
    },
    {
      id: 'senha-confirmacao',
      rotulo: 'Repita a nova senha',
      valor: confirmacao,
      onChange: setConfirmacao,
      placeholder: 'Digite a nova senha outra vez',
      autoComplete: 'new-password'
    }
  ];

  // O modal SAI do DOM do Topbar antes de ser desenhado, e isso não é preferência de
  // organização: o `<header>` tem `backdrop-blur-xl`, e um elemento com `backdrop-filter`
  // **vira bloco de contenção para descendentes `position: fixed`** (CSS Containment /
  // Filter Effects). Renderizado ali dentro, o `fixed inset-0` deste modal resolvia contra
  // a faixa de 64px do cabeçalho em vez da viewport: ele centralizava dentro do header,
  // vazava para fora da tela (o título e o campo "Senha atual" ficavam cortados acima) e o
  // fundo escurecido cobria só a tira do topo.
  //
  // `transform`, `filter`, `perspective`, `contain` e `will-change` têm o mesmo efeito.
  // **Todo modal `fixed` renderizado a partir do Topbar ou da Sidebar precisa de portal** —
  // não dá para saber pelo componente do modal quem vai montá-lo.
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-bg-surface border border-border-default rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-default shrink-0">
          <h2 className="text-base font-bold text-text-base flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-[#3B82F6]" />
            Alterar minha senha
          </h2>
          <button
            type="button"
            onClick={fechar}
            disabled={salvando}
            className="p-1.5 rounded-lg hover:bg-bg-base text-text-subtle transition-colors disabled:opacity-40"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          <p className="text-xs text-text-subtle leading-relaxed">
            A troca vale para a conta{' '}
            <span className="font-semibold text-text-base">{emailDaConta}</span>. Pedimos a
            senha atual para confirmar que é você — uma sessão aberta, sozinha, não basta.
          </p>

          {campos.map((campo) => (
            <div key={campo.id}>
              <label
                htmlFor={campo.id}
                className="block text-sm font-semibold text-text-subtle mb-1"
              >
                {campo.rotulo}
              </label>
              <div className="relative">
                <input
                  id={campo.id}
                  name={campo.id}
                  type={mostrarSenhas ? 'text' : 'password'}
                  autoComplete={campo.autoComplete}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  data-no-uppercase="true"
                  value={campo.valor}
                  placeholder={campo.placeholder}
                  onChange={(e) => campo.onChange(e.target.value)}
                  className={campoClasse}
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenhas((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-subtle hover:text-text-base"
                  title={mostrarSenhas ? 'Ocultar senhas' : 'Mostrar senhas'}
                >
                  {mostrarSenhas ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* O medidor fica colado ao campo que ele mede. Desenhado no fim do
                  formulário, ele encostava em "Repita a nova senha" e passava a
                  parecer a força da confirmação — que não é o que ele calcula. */}
              {campo.id === 'senha-nova' && novaSenha.length > 0 && (
                <div className="mt-2">
                  <div className="flex gap-1.5" aria-hidden="true">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className={`h-1.5 flex-1 rounded-full transition-colors ${
                          i < cores.passos ? cores.barra : 'bg-border-default'
                        }`}
                      />
                    ))}
                  </div>
                  <p className={`text-xs mt-1.5 ${cores.texto}`}>{dicaDeForca(forca)}</p>
                </div>
              )}
            </div>
          ))}

          {erro && (
            <div className="flex items-start gap-2 p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{erro}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={fechar}
              disabled={salvando}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-text-subtle hover:bg-bg-base transition-colors disabled:opacity-40"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando || !validacao.ok}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#3B82F6] text-white hover:bg-[#2f6fd8] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title={validacao.ok ? 'Alterar senha' : validacao.mensagem}
            >
              {salvando ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ShieldCheck className="w-4 h-4" />
              )}
              {salvando ? 'Alterando...' : 'Alterar senha'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
