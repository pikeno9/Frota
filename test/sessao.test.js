import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarSessao } from '../src/sessao.js';

const T0 = 1_800_000_000_000;
const OITO_HORAS = 8 * 60 * 60 * 1000;

test('ida e volta', () => {
  const s = criarSessao('segredo-longo');
  const v = s.assinar({ u: 'enrico', admin: true }, T0 + OITO_HORAS);
  assert.deepEqual(s.ler(v, T0), { u: 'enrico', admin: true });
});

test('expirado devolve null', () => {
  const s = criarSessao('segredo-longo');
  const v = s.assinar({ u: 'enrico', admin: false }, T0 + 1000);
  assert.equal(s.ler(v, T0 + 2000), null);
});

test('adulterado devolve null', () => {
  const s = criarSessao('segredo-longo');
  const v = s.assinar({ u: 'joao', admin: false }, T0 + OITO_HORAS);
  const [payload, assinatura] = v.split('.');
  const falso = Buffer.from(JSON.stringify({ u: 'joao', admin: true, exp: T0 + OITO_HORAS })).toString('base64url');
  assert.equal(s.ler(`${falso}.${assinatura}`, T0), null, 'virar admin na marra não pode funcionar');
  assert.ok(payload);
});

test('outro segredo não valida', () => {
  const v = criarSessao('segredo-A').assinar({ u: 'x', admin: false }, T0 + OITO_HORAS);
  assert.equal(criarSessao('segredo-B').ler(v, T0), null);
});

test('lixo devolve null sem lançar', () => {
  const s = criarSessao('segredo-longo');
  for (const lixo of ['', 'abc', 'a.b.c', '....', 'YWJj.xyz']) {
    assert.equal(s.ler(lixo, T0), null, `falhou com: ${JSON.stringify(lixo)}`);
  }
});
