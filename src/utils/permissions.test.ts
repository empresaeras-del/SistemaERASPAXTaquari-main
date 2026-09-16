import { describe, it, expect } from 'vitest';
import { canChangeUserPassword } from './permissions';
import { Usuario } from '../types';

const usuario = (
  id: string,
  nivel: Usuario['nivel'],
  tenant_id = 'emp-1'
): Usuario => ({
  id,
  nome: `Usuário ${id}`,
  email: `${id}@empresa.com`,
  nivel,
  modulos_permitidos: ['*'],
  tenant_id,
});

const superAdmin = usuario('super', 'super_admin', 'default');
const admin = usuario('admin-1', 'admin');
const gerente = usuario('gerente-1', 'gerente');
const funcionario = usuario('func-1', 'funcionario');

/**
 * A guarda do banco, em `admin_alterar_senha_usuario`:
 *   IF v_current_nivel = 'super_admin' OR v_current_user_id = target_user_id
 * O predicado do frontend precisa dizer exatamente isso — quando as duas metades
 * discordam, quem descobre é o operador, no momento de salvar.
 */
const guardaDoBanco = (autor: Usuario, alvo: Usuario) =>
  autor.nivel === 'super_admin' || autor.id === alvo.id;

describe('canChangeUserPassword', () => {
  it('super_admin redefine a senha de qualquer nível', () => {
    for (const alvo of [admin, gerente, funcionario, superAdmin]) {
      expect(canChangeUserPassword(superAdmin, alvo)).toBe(true);
    }
  });

  it('qualquer usuário altera a própria senha', () => {
    expect(canChangeUserPassword(admin, admin)).toBe(true);
    expect(canChangeUserPassword(gerente, gerente)).toBe(true);
    expect(canChangeUserPassword(funcionario, funcionario)).toBe(true);
  });

  it('admin NÃO redefine a senha de outro usuário, nem da própria empresa', () => {
    // Era o que a tela liberava e a RPC recusava com "Permissão negada".
    expect(canChangeUserPassword(admin, funcionario)).toBe(false);
    expect(canChangeUserPassword(admin, gerente)).toBe(false);
    expect(canChangeUserPassword(admin, usuario('admin-2', 'admin'))).toBe(false);
    expect(canChangeUserPassword(admin, superAdmin)).toBe(false);
  });

  it('gerente e funcionário não redefinem a senha de ninguém além de si', () => {
    expect(canChangeUserPassword(gerente, funcionario)).toBe(false);
    expect(canChangeUserPassword(funcionario, gerente)).toBe(false);
  });

  it('offline não deixa ninguém trocar senha, nem a própria', () => {
    expect(canChangeUserPassword(superAdmin, funcionario, false)).toBe(false);
    expect(canChangeUserPassword(funcionario, funcionario, false)).toBe(false);
  });

  it('sem usuário de um dos lados, recusa', () => {
    expect(canChangeUserPassword(null, funcionario)).toBe(false);
    expect(canChangeUserPassword(superAdmin, null)).toBe(false);
    expect(canChangeUserPassword(undefined, undefined)).toBe(false);
  });

  it('espelha a guarda do banco em todos os pares de níveis', () => {
    const todos = [superAdmin, admin, gerente, funcionario];
    for (const autor of todos) {
      for (const alvo of todos) {
        expect({
          autor: autor.nivel,
          alvo: alvo.nivel,
          pode: canChangeUserPassword(autor, alvo),
        }).toEqual({
          autor: autor.nivel,
          alvo: alvo.nivel,
          pode: guardaDoBanco(autor, alvo),
        });
      }
    }
  });
});
