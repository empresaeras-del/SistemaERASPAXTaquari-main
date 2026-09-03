import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: ['dist', 'dev-dist', 'node_modules'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      // Usamos apenas as regras clássicas de hooks (corretude), não o bundle
      // "recommended" completo do plugin — este inclui, desde a v6/v7, um
      // conjunto de regras voltadas para adoção do React Compiler
      // (set-state-in-effect, purity, immutability, refs, etc.) que são
      // extremamente agressivas para uma base de código existente e não
      // preparada para o compiler; adotá-las exigiria uma revisão profunda
      // de dezenas de componentes, fora do escopo desta rede de segurança
      // mínima de lint/typecheck.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      // O projeto ainda usa `any` e tem variáveis não utilizadas em diversos
      // pontos legados; mantemos como aviso (não erro) para não bloquear o
      // CI enquanto isso é corrigido aos poucos, sem perder a visibilidade.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Padrão recorrente no código: catch (e) {} para ignorar erros
      // intencionalmente (ex.: fallback silencioso ao offline/IndexedDB).
      'no-empty': ['error', { allowEmptyCatch: true }],
      'react/prop-types': 'off',
    },
  },
  prettierConfig,
);
