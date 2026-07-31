import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarApp } from '../src/app.js';

async function subir(app) {
  const servidor = app.listen(0);
  await new Promise(r => servidor.once('listening', r));
  const url = `http://127.0.0.1:${servidor.address().port}`;
  return { url, fechar: () => new Promise(r => servidor.close(r)) };
}

test('GET /saude responde ok', async () => {
  const { url, fechar } = await subir(criarApp({}));
  const r = await fetch(`${url}/saude`);
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true });
  await fechar();
});
