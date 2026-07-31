import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { montarPecas } from '../servidor.js';

const CREDENCIAL_VALIDA = '{"client_email":"conta@teste.iam.gserviceaccount.com"}';

test('montarPecas exige as variáveis obrigatórias', () => {
  assert.throws(() => montarPecas({}), /PLANILHA_ID/);
  assert.throws(() => montarPecas({ PLANILHA_ID: 'x' }), /GOOGLE_SERVICE_ACCOUNT_JSON/);
  assert.throws(() => montarPecas({ PLANILHA_ID: 'x', GOOGLE_SERVICE_ACCOUNT_JSON: CREDENCIAL_VALIDA }), /SESSION_SECRET/);
});

test('montarPecas rejeita GOOGLE_SERVICE_ACCOUNT_JSON inválido ou incompleto', () => {
  assert.throws(
    () => montarPecas({ PLANILHA_ID: 'x', GOOGLE_SERVICE_ACCOUNT_JSON: 'não é json', SESSION_SECRET: 'seg' }),
    /GOOGLE_SERVICE_ACCOUNT_JSON/
  );
  assert.throws(
    () => montarPecas({ PLANILHA_ID: 'x', GOOGLE_SERVICE_ACCOUNT_JSON: '{}', SESSION_SECRET: 'seg' }),
    /GOOGLE_SERVICE_ACCOUNT_JSON/
  );
});

test('confiarProxy e cookieSeguro só ligam em produção', () => {
  const dir = mkdtempSync(join(tmpdir(), 'frota-p-'));
  const base = {
    PLANILHA_ID: 'x', GOOGLE_SERVICE_ACCOUNT_JSON: CREDENCIAL_VALIDA, SESSION_SECRET: 'seg',
    DB_PATH: join(dir, 'f.db'), COPIA_PATH: join(dir, 'c.json')
  };
  const fora = montarPecas(base);
  assert.equal(fora.confiarProxy, false, 'fora de produção o IP é o real');
  assert.equal(fora.cookieSeguro, false, 'fora de produção não exige HTTPS no cookie');
  fora.usuarios.fechar();

  const prod = montarPecas({ ...base, NODE_ENV: 'production', DB_PATH: join(dir, 'g.db') });
  assert.equal(prod.confiarProxy, true, 'atrás do proxy do Railway o IP real vem no cabeçalho');
  assert.equal(prod.cookieSeguro, true, 'em produção o cookie só vai por HTTPS');
  prod.usuarios.fechar();
  rmSync(dir, { recursive: true, force: true });
});

test('criarApp respeita confiarProxy', async () => {
  const { criarApp } = await import('../src/app.js');
  assert.equal(criarApp({ confiarProxy: true }).get('trust proxy'), 1);
  assert.ok(!criarApp({}).get('trust proxy'), 'sem a chave, o padrão do Express fica intacto');
});

test('montarPecas cria o admin inicial quando o banco está vazio', () => {
  const dir = mkdtempSync(join(tmpdir(), 'frota-s-'));
  const pecas = montarPecas({
    PLANILHA_ID: 'x', GOOGLE_SERVICE_ACCOUNT_JSON: CREDENCIAL_VALIDA, SESSION_SECRET: 'seg',
    ADMIN_SENHA_INICIAL: 'primeira', DB_PATH: join(dir, 'f.db'), COPIA_PATH: join(dir, 'c.json')
  });
  assert.deepEqual(pecas.usuarios.autenticar('admin', 'primeira'), { ok: true, admin: true });
  pecas.usuarios.fechar();
  rmSync(dir, { recursive: true, force: true });
});
