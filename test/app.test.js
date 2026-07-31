import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { criarApp } from '../src/app.js';
import { criarUsuarios } from '../src/usuarios.js';
import { criarSessao } from '../src/sessao.js';
import { criarCache } from '../src/cache.js';

const T0 = 1_800_000_000_000;

const MOTORISTAS = ['Ana Beatriz Moraes', 'Carlos Eduardo Lima'];

function matrizBoa(qtd = 3) {
  const linhas = [['Placa', 'Fabricante', 'Modelo', 'Status', 'Nome do motorista']];
  for (let i = 0; i < qtd; i++) {
    linhas.push(['ABC' + (1000 + i), 'VOLKSWAGEN', 'Polo', 'Alugado', MOTORISTAS[i] ?? 'Motorista ' + i]);
  }
  return linhas;
}

/* A segunda aba: uma linha por locação, cabeçalho fora da primeira linha para o
   servidor ter que procurar, como faz na aba principal. */
function matrizContatos() {
  return [
    ['Relatório de importação'],
    [],
    ['Nome do motorista', '', 'Telefone', 'CPF do motorista', 'Placa do veículo'],
    ['Ana Beatriz Moraes', '', '11987654321', '12345678901', 'ABC1000'],
    ['Carlos Eduardo Lima', '', '', '22222222222', 'ABC1001']
  ];
}

function montar({ matriz = matrizBoa(), falhar = false,
                  contatos = matrizContatos(), falharContatos = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'frota-app-'));
  const usuarios = criarUsuarios({ caminhoBanco: join(dir, 'u.db') });
  usuarios.garantirAdminInicial('senha-admin');
  usuarios.criar('joao', 'senha-joao', false);

  const app = criarApp({
    usuarios,
    sessao: criarSessao('segredo-de-teste'),
    cache: criarCache({ arquivo: join(dir, 'c.json'), minutos: 5 }),
    leitor: { ler: async () => { if (falhar) throw new Error('403'); return matriz; } },
    leitorContatos: {
      ler: async () => {
        if (falharContatos) throw new Error('403 na aba de contatos');
        return contatos;
      }
    },
    agora: () => T0
  });

  return { app, usuarios, limpar: () => { usuarios.fechar(); rmSync(dir, { recursive: true, force: true }); } };
}

async function subir(app) {
  const s = app.listen(0);
  await new Promise(r => s.once('listening', r));
  return { url: `http://127.0.0.1:${s.address().port}`, fechar: () => new Promise(r => s.close(r)) };
}

async function entrar(url, usuario, senha) {
  const r = await fetch(`${url}/api/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario, senha })
  });
  return { status: r.status, cookie: r.headers.getSetCookie?.()[0] ?? r.headers.get('set-cookie'), corpo: await r.json() };
}

test('sem sessão, /api/veiculos responde 401', async () => {
  const { app, limpar } = montar();
  const { url, fechar } = await subir(app);
  assert.equal((await fetch(`${url}/api/veiculos`)).status, 401);
  await fechar(); limpar();
});

test('senha errada não devolve cookie', async () => {
  const { app, limpar } = montar();
  const { url, fechar } = await subir(app);
  const r = await entrar(url, 'admin', 'errada');
  assert.equal(r.status, 401);
  assert.ok(!r.cookie);
  await fechar(); limpar();
});

test('login certo devolve cookie httpOnly e dá acesso aos veículos', async () => {
  const { app, limpar } = montar({ matriz: matrizBoa(3) });
  const { url, fechar } = await subir(app);

  const login = await entrar(url, 'admin', 'senha-admin');
  assert.equal(login.status, 200);
  assert.match(login.cookie, /HttpOnly/i);

  const r = await fetch(`${url}/api/veiculos`, { headers: { Cookie: login.cookie } });
  assert.equal(r.status, 200);
  const corpo = await r.json();
  assert.equal(corpo.veiculos.length, 3);
  assert.equal(corpo.veiculos[0].Placa, 'ABC1000');
  assert.equal(corpo.aviso, null);
  await fechar(); limpar();
});

test('/api/veiculos traz o CPF e o telefone da segunda aba, casados pelo motorista', async () => {
  const { app, limpar } = montar({ matriz: matrizBoa(3) });
  const { url, fechar } = await subir(app);
  const login = await entrar(url, 'admin', 'senha-admin');

  const corpo = await (await fetch(`${url}/api/veiculos`, { headers: { Cookie: login.cookie } })).json();
  const [ana, carlos, semContato] = corpo.veiculos;

  assert.equal(ana.CPF, '123.456.789-01');
  assert.equal(ana.Telefone, '(11) 98765-4321');
  assert.equal(carlos.CPF, '222.222.222-22');
  assert.equal(carlos.Telefone, '', 'metade da frota não tem telefone na planilha');
  assert.equal(semContato.CPF, '', 'motorista fora da segunda aba fica sem contato, não com contato errado');
  assert.ok(Object.hasOwn(semContato, 'Telefone'), 'o campo existe para a tela desenhar traço');
  await fechar(); limpar();
});

test('REGRA CENTRAL: a segunda aba fora do ar não derruba a lista de veículos', async () => {
  const { app, limpar } = montar({ matriz: matrizBoa(3), falharContatos: true });
  const { url, fechar } = await subir(app);
  const login = await entrar(url, 'admin', 'senha-admin');

  const r = await fetch(`${url}/api/veiculos`, { headers: { Cookie: login.cookie } });
  assert.equal(r.status, 200, 'contato é bônus; veículo é o produto');
  const corpo = await r.json();
  assert.equal(corpo.veiculos.length, 3);
  assert.equal(corpo.aviso, null, 'falhar a segunda aba não é problema da planilha principal');
  assert.ok(!Object.hasOwn(corpo.veiculos[0], 'CPF'), 'sem a aba lida, a tela não finge que tem a coluna');
  await fechar(); limpar();
});

test('sem leitor de contatos configurado, a rota segue de pé', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'frota-app5-'));
  const usuarios = criarUsuarios({ caminhoBanco: join(dir, 'u.db') });
  usuarios.garantirAdminInicial('senha-admin');
  const app = criarApp({
    usuarios, sessao: criarSessao('s'),
    cache: criarCache({ arquivo: join(dir, 'c.json'), minutos: 5 }),
    leitor: { ler: async () => matrizBoa(2) }, agora: () => T0
  });
  const { url, fechar } = await subir(app);
  try {
    const login = await entrar(url, 'admin', 'senha-admin');
    const corpo = await (await fetch(`${url}/api/veiculos`, { headers: { Cookie: login.cookie } })).json();
    assert.equal(corpo.veiculos.length, 2);
  } finally {
    await fechar(); usuarios.fechar(); rmSync(dir, { recursive: true, force: true });
  }
});

test('o diagnóstico conta o que veio da segunda aba', async () => {
  const { app, limpar } = montar({ matriz: matrizBoa(3) });
  const { url, fechar } = await subir(app);
  const login = await entrar(url, 'admin', 'senha-admin');
  const d = await (await fetch(`${url}/api/diagnostico`, { headers: { Cookie: login.cookie } })).json();
  assert.equal(d.contatos.linhaCabecalho, 3, 'achou o cabeçalho da segunda aba sozinho');
  assert.equal(d.contatos.comCpf, 2, 'dois veículos casaram com CPF');
  assert.equal(d.contatos.comTelefone, 1);
  await fechar(); limpar();
});

test('planilha quebrada: serve a cópia boa com aviso', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'frota-app2-'));
  const usuarios = criarUsuarios({ caminhoBanco: join(dir, 'u.db') });
  usuarios.garantirAdminInicial('senha-admin');
  const cache = criarCache({ arquivo: join(dir, 'c.json'), minutos: 0 });  // sempre revalida

  let matriz = matrizBoa(5);
  const app = criarApp({
    usuarios, sessao: criarSessao('s'), cache,
    leitor: { ler: async () => matriz }, agora: () => T0
  });

  const { url, fechar } = await subir(app);
  const login = await entrar(url, 'admin', 'senha-admin');

  const bom = await (await fetch(`${url}/api/veiculos`, { headers: { Cookie: login.cookie } })).json();
  assert.equal(bom.veiculos.length, 5);

  matriz = [['Frota', 'Modelo'], ['23006', 'Polo']];   // cabeçalho sem Placa — a quebra de 30/07
  const depois = await (await fetch(`${url}/api/veiculos`, { headers: { Cookie: login.cookie } })).json();
  assert.equal(depois.veiculos.length, 5, 'continua servindo os 5 bons');
  assert.match(depois.aviso.motivo, /Placa/);

  await fechar(); usuarios.fechar(); rmSync(dir, { recursive: true, force: true });
});

test('Google fora do ar não derruba a rota', async () => {
  const { app, limpar } = montar({ falhar: true });
  const { url, fechar } = await subir(app);
  const login = await entrar(url, 'admin', 'senha-admin');
  const r = await fetch(`${url}/api/veiculos`, { headers: { Cookie: login.cookie } });
  assert.equal(r.status, 503);
  assert.match((await r.json()).erro, /planilha/i);
  await fechar(); limpar();
});

test('erro 503 não vaza o texto cru da exceção pro cliente', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'frota-app4-'));
  const usuarios = criarUsuarios({ caminhoBanco: join(dir, 'u.db') });
  usuarios.garantirAdminInicial('senha-admin');
  const SEGREDO_DO_GOOGLE = 'service-account@projeto-secreto.iam.gserviceaccount.com';

  const app = criarApp({
    usuarios, sessao: criarSessao('s'), cache: criarCache({ arquivo: join(dir, 'c.json'), minutos: 5 }),
    leitor: { ler: async () => { throw new Error(`Google respondeu 403: ${SEGREDO_DO_GOOGLE}`); } },
    agora: () => T0
  });

  const { url, fechar } = await subir(app);
  try {
    const login = await entrar(url, 'admin', 'senha-admin');
    const r = await fetch(`${url}/api/veiculos`, { headers: { Cookie: login.cookie } });
    assert.equal(r.status, 503);
    const corpo = await r.json();
    assert.ok(!corpo.erro.includes(SEGREDO_DO_GOOGLE), 'a mensagem crua do Google não pode chegar no cliente');
    assert.match(corpo.erro, /planilha/i);
  } finally {
    await fechar(); usuarios.fechar(); rmSync(dir, { recursive: true, force: true });
  }
});

test('Google fora do ar depois de já ter cache: aviso não fica nulo', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'frota-app3-'));
  const usuarios = criarUsuarios({ caminhoBanco: join(dir, 'u.db') });
  usuarios.garantirAdminInicial('senha-admin');
  const cache = criarCache({ arquivo: join(dir, 'c.json'), minutos: 0 });  // sempre revalida

  let falhar = false;
  const app = criarApp({
    usuarios, sessao: criarSessao('s'), cache,
    leitor: { ler: async () => { if (falhar) throw new Error('403 chave revogada'); return matrizBoa(4); } },
    agora: () => T0
  });

  const { url, fechar } = await subir(app);
  try {
    const login = await entrar(url, 'admin', 'senha-admin');

    const bom = await (await fetch(`${url}/api/veiculos`, { headers: { Cookie: login.cookie } })).json();
    assert.equal(bom.veiculos.length, 4);
    assert.equal(bom.aviso, null);

    falhar = true;
    const r = await fetch(`${url}/api/veiculos`, { headers: { Cookie: login.cookie } });
    assert.equal(r.status, 200, 'ainda tem cópia boa, então responde 200');
    const depois = await r.json();
    assert.equal(depois.veiculos.length, 4, 'continua servindo a cópia boa');
    assert.notEqual(depois.aviso, null, 'o aviso não pode ficar nulo quando o Google falhou');
    assert.ok(depois.aviso?.motivo, 'precisa ter um motivo explicando o problema');

    const diagAdmin = await entrar(url, 'admin', 'senha-admin');
    const diag = await (await fetch(`${url}/api/diagnostico`, { headers: { Cookie: diagAdmin.cookie } })).json();
    assert.notEqual(diag.problema, null, '/api/diagnostico também precisa reportar o problema');
    assert.ok(diag.servindoDaCopia, true);
  } finally {
    await fechar(); usuarios.fechar(); rmSync(dir, { recursive: true, force: true });
  }
});

test('/api/diagnostico é só para admin', async () => {
  const { app, limpar } = montar();
  const { url, fechar } = await subir(app);

  const joao = await entrar(url, 'joao', 'senha-joao');
  assert.equal((await fetch(`${url}/api/diagnostico`, { headers: { Cookie: joao.cookie } })).status, 403);

  const admin = await entrar(url, 'admin', 'senha-admin');
  const r = await fetch(`${url}/api/diagnostico`, { headers: { Cookie: admin.cookie } });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).linhaCabecalho, 1);
  await fechar(); limpar();
});

test('gerenciar usuários é só para admin', async () => {
  const { app, limpar } = montar();
  const { url, fechar } = await subir(app);
  const joao = await entrar(url, 'joao', 'senha-joao');
  const r = await fetch(`${url}/api/usuarios`, { headers: { Cookie: joao.cookie } });
  assert.equal(r.status, 403);
  await fechar(); limpar();
});

test('após 5 senhas erradas o login passa a ser barrado', async () => {
  const { app, limpar } = montar();
  const { url, fechar } = await subir(app);
  for (let i = 0; i < 5; i++) await entrar(url, 'admin', 'errada');
  const r = await entrar(url, 'admin', 'senha-admin');
  assert.equal(r.status, 429, 'mesmo com a senha certa, espera a janela passar');
  await fechar(); limpar();
});
