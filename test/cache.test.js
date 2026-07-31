import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { criarCache } from '../src/cache.js';

const T0 = 1_800_000_000_000;

function pasta() { return mkdtempSync(join(tmpdir(), 'frota-')); }

function boa(qtd = 3) {
  return {
    veiculos: Array.from({ length: qtd }, (_, i) => ({ Placa: 'ABC' + i })),
    linhaCabecalho: 10, colunasDaPlanilha: ['Placa'], colunasAchadas: ['Placa'], colunasFaltando: []
  };
}

const SEM_CABECALHO = { veiculos: [], linhaCabecalho: null, colunasDaPlanilha: [], colunasAchadas: [], colunasFaltando: ['Placa'] };
const SEM_PLACA     = { veiculos: [], linhaCabecalho: 8, colunasDaPlanilha: ['Modelo'], colunasAchadas: ['Modelo'], colunasFaltando: ['Placa'] };
const ZERO_VEICULOS = { veiculos: [], linhaCabecalho: 10, colunasDaPlanilha: ['Placa'], colunasAchadas: ['Placa'], colunasFaltando: [] };

test('leitura boa é aceita e vira a última', () => {
  const dir = pasta();
  const c = criarCache({ arquivo: join(dir, 'd.json'), minutos: 5 });
  assert.deepEqual(c.oferecer(boa(3), T0), { aceita: true, motivo: null });
  assert.equal(c.ultima().veiculos.length, 3);
  assert.equal(c.problema(), null);
  rmSync(dir, { recursive: true, force: true });
});

test('sem cabeçalho é recusada, com motivo', () => {
  const dir = pasta();
  const c = criarCache({ arquivo: join(dir, 'd.json'), minutos: 5 });
  const r = c.oferecer(SEM_CABECALHO, T0);
  assert.equal(r.aceita, false);
  assert.match(r.motivo, /cabeçalho/i);
  rmSync(dir, { recursive: true, force: true });
});

test('sem coluna Placa é recusada', () => {
  const dir = pasta();
  const c = criarCache({ arquivo: join(dir, 'd.json'), minutos: 5 });
  const r = c.oferecer(SEM_PLACA, T0);
  assert.equal(r.aceita, false);
  assert.match(r.motivo, /Placa/);
  rmSync(dir, { recursive: true, force: true });
});

test('zero veículos é recusada', () => {
  const dir = pasta();
  const c = criarCache({ arquivo: join(dir, 'd.json'), minutos: 5 });
  assert.equal(c.oferecer(ZERO_VEICULOS, T0).aceita, false);
  rmSync(dir, { recursive: true, force: true });
});

test('REGRA CENTRAL: leitura ruim não apaga a boa anterior', () => {
  const dir = pasta();
  const c = criarCache({ arquivo: join(dir, 'd.json'), minutos: 5 });
  c.oferecer(boa(989), T0);
  c.oferecer(SEM_PLACA, T0 + 60_000);
  assert.equal(c.ultima().veiculos.length, 989, 'a boa continua servida');
  assert.equal(c.ultima().lidoEm, T0, 'e continua marcada com a hora dela');
  assert.equal(c.problema().desde, T0 + 60_000);
  assert.match(c.problema().motivo, /Placa/);
  rmSync(dir, { recursive: true, force: true });
});

test('leitura boa depois de problema limpa o problema', () => {
  const dir = pasta();
  const c = criarCache({ arquivo: join(dir, 'd.json'), minutos: 5 });
  c.oferecer(boa(2), T0);
  c.oferecer(SEM_PLACA, T0 + 1000);
  c.oferecer(boa(5), T0 + 2000);
  assert.equal(c.problema(), null);
  assert.equal(c.ultima().veiculos.length, 5);
  rmSync(dir, { recursive: true, force: true });
});

test('fresco respeita a janela de minutos', () => {
  const dir = pasta();
  const c = criarCache({ arquivo: join(dir, 'd.json'), minutos: 5 });
  assert.equal(c.fresco(T0), false, 'sem leitura nenhuma não é fresco');
  c.oferecer(boa(), T0);
  assert.equal(c.fresco(T0 + 4 * 60_000), true);
  assert.equal(c.fresco(T0 + 6 * 60_000), false);
  rmSync(dir, { recursive: true, force: true });
});

test('a última boa sobrevive a um reinício', () => {
  const dir = pasta();
  const arquivo = join(dir, 'd.json');
  criarCache({ arquivo, minutos: 5 }).oferecer(boa(7), T0);

  const depoisDoReinicio = criarCache({ arquivo, minutos: 5 });
  assert.equal(depoisDoReinicio.ultima().veiculos.length, 7);
  assert.equal(depoisDoReinicio.ultima().lidoEm, T0);
  rmSync(dir, { recursive: true, force: true });
});

test('arquivo corrompido no disco não derruba o servidor', () => {
  const dir = pasta();
  const arquivo = join(dir, 'd.json');
  writeFileSync(arquivo, '{isso não é json');
  const c = criarCache({ arquivo, minutos: 5 });
  assert.equal(c.ultima(), null);
  assert.equal(c.oferecer(boa(1), T0).aceita, true);
  rmSync(dir, { recursive: true, force: true });
});
