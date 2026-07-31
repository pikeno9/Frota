import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarLeitor } from '../src/planilha.js';

test('monta a URL com o id e a aba, e devolve values', async () => {
  let urlChamada = null;
  const leitor = criarLeitor({
    planilhaId: 'ID123', aba: 'import_data', credenciaisJson: '{}',
    buscar: async url => { urlChamada = url; return { values: [['Placa'], ['ABC1234']] }; }
  });

  const m = await leitor.ler();
  assert.ok(urlChamada.includes('/ID123/'), urlChamada);
  assert.ok(urlChamada.includes('import_data'), urlChamada);
  assert.deepEqual(m, [['Placa'], ['ABC1234']]);
});

test('resposta sem values vira matriz vazia', async () => {
  const leitor = criarLeitor({
    planilhaId: 'X', aba: 'import_data', credenciaisJson: '{}', buscar: async () => ({})
  });
  assert.deepEqual(await leitor.ler(), []);
});

test('erro do Google sobe para quem chamou', async () => {
  const leitor = criarLeitor({
    planilhaId: 'X', aba: 'import_data', credenciaisJson: '{}',
    buscar: async () => { throw new Error('403 sem permissão'); }
  });
  await assert.rejects(() => leitor.ler(), /403/);
});
