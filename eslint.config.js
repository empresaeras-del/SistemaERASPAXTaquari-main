import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'node_modules'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // Só as duas regras clássicas do react-hooks (ordem de hooks + deps de
      // efeito). O preset "recommended" do eslint-plugin-react-hooks v7 traz
      // também as regras de alinhamento com o React Compiler (purity,
      // immutability, set-state-in-effect...), que são bem mais rígidas do
      // que o estilo atual do código (heavy useEffect/setState, refs, mutação
      // direta) — adotar isso é um esforço à parte, não algo pra ligar de
      // uma vez como parte da baseline de lint.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': 'off',

      // Regras rebaixadas para "warn": o código já tem centenas de casos
      // existentes. Rebaixar em vez de desligar mantém o aviso visível
      // (inclusive no editor) sem quebrar o build enquanto isso é corrigido
      // aos poucos — ver o item "strict gradual" do diagnóstico do projeto.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-empty-object-type': 'warn',
      'no-empty': 'warn',
      'no-case-declarations': 'warn',
      'no-constant-condition': ['warn', { checkLoops: false }],
      'no-constant-binary-expression': 'warn',
      // Ambas pegam bastante caso benigno neste código (valor padrão
      // atribuído antes de um try/if que pode ou não sobrescrevê-lo;
      // re-throw sem preservar `cause`) — vale revisar aos poucos, mas não
      // como erro bloqueante agora.
      'no-useless-assignment': 'warn',
      'preserve-caught-error': 'warn',
    },
  }
);
