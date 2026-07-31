import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { criarUsuarios } from '../src/usuarios.js';

const hashLegado = senha => createHash('sha256').update(senha + 'lmfrotas_salt').digest('hex');

function novo() {
  const dir = mkdtempSync(join(tmpdir(), 'frota-u-'));
  const u = criarUsuarios({ caminhoBanco: join(dir, 'u.db') });
  return { u, limpar: () => { u.fechar(); rmSync(dir, { recursive: true, force: true }); } };
}

test('garantirAdminInicial cria o admin só uma vez', () => {
  const { u, limpar } = novo();
  assert.equal(u.garantirAdminInicial('senha-forte'), true);
  assert.equal(u.garantirAdminInicial('outra'), false, 'não recria nem troca a senha');
  assert.deepEqual(u.autenticar('admin', 'senha-forte'), { ok: true, admin: true });
  limpar();
});

test('senha errada não entra', () => {
  const { u, limpar } = novo();
  u.garantirAdminInicial('certa');
  assert.equal(u.autenticar('admin', 'errada').ok, false);
  assert.equal(u.autenticar('ninguem', 'certa').ok, false);
  limpar();
});

test('hash herdado do Apps Script continua valendo', () => {
  const { u, limpar } = novo();
  u.importarLegado([{ usuario: 'enrico', senha_hash: hashLegado('minhasenha'), isAdmin: true, ativo: true }]);
  assert.deepEqual(u.autenticar('enrico', 'minhasenha'), { ok: true, admin: true });
  limpar();
});

test('o hash herdado vira scrypt no primeiro login certo', () => {
  const { u, limpar } = novo();
  u.importarLegado([{ usuario: 'enrico', senha_hash: hashLegado('minhasenha'), isAdmin: false, ativo: true }]);
  assert.equal(u.hashDe('enrico').startsWith('scrypt$'), false);
  u.autenticar('enrico', 'minhasenha');
  assert.equal(u.hashDe('enrico').startsWith('scrypt$'), true, 'migrou');
  assert.deepEqual(u.autenticar('enrico', 'minhasenha'), { ok: true, admin: false }, 'e continua entrando');
  limpar();
});

test('importarLegado reporta só quem realmente entrou, não quem foi ignorado por já existir', () => {
  const { u, limpar } = novo();
  u.importarLegado([{ usuario: 'enrico', senha_hash: hashLegado('x'), isAdmin: false, ativo: true }]);
  const r = u.importarLegado([
    { usuario: 'enrico', senha_hash: hashLegado('x'), isAdmin: false, ativo: true },  // já existe, é ignorado
    { usuario: 'joao', senha_hash: hashLegado('y'), isAdmin: false, ativo: true }
  ]);
  assert.equal(r.importados, 1, 'só joao entrou de fato nesta chamada');
  limpar();
});

test('usuário inativo não entra', () => {
  const { u, limpar } = novo();
  u.importarLegado([{ usuario: 'saiu', senha_hash: hashLegado('x'), isAdmin: false, ativo: false }]);
  assert.equal(u.autenticar('saiu', 'x').ok, false);
  limpar();
});

test('criar, listar, redefinir e remover', () => {
  const { u, limpar } = novo();
  u.garantirAdminInicial('a');
  assert.equal(u.criar('joao', 'senha1', false).ok, true);
  assert.equal(u.criar('joao', 'outra', false).ok, false, 'não duplica');
  assert.deepEqual(u.listar().map(x => x.usuario).sort(), ['admin', 'joao']);
  assert.equal(u.autenticar('joao', 'senha1').ok, true);
  u.redefinir('joao', 'senha2');
  assert.equal(u.autenticar('joao', 'senha1').ok, false);
  assert.equal(u.autenticar('joao', 'senha2').ok, true);
  u.remover('joao');
  assert.equal(u.listar().length, 1);
  limpar();
});
