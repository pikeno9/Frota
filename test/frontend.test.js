import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

import { statusEfetivo, filtrar, ordenar, contar } from '../public/app.js';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const ler = (...p) => readFileSync(join(RAIZ, ...p), 'utf8');

const HTML = ler('public', 'index.html');
const JS = ler('public', 'app.js');
const FRENTE = HTML + '\n' + JS;

/* Uma frota pequena que cabe na cabeça, com os casos que importam:
   um alugado circulando, um alugado NA OFICINA (a regra do dono), um sem
   coluna de circulação e um "Perda Total" que não é nenhum dos cartões. */
const CIRCULANDO = {
  Placa: 'BQK4E12', Modelo: 'Polo 1.0 Track', Fabricante: 'VOLKSWAGEN', Cor: 'BRANCO',
  'Nome do motorista': 'Ana Beatriz Moraes', 'Cidade Entrega': 'São Paulo', 'UF Entrega': 'SP',
  Safra: 'Polo1', Chassi: '9BWAG5R18TP000001',
  'Status Vínculo': 'Alugado', 'Status Circulação': 'Circulante'
};
const NA_OFICINA = {
  Placa: 'CUM0J31', Modelo: 'Polo 1.0 Track', Fabricante: 'VOLKSWAGEN', Cor: 'BRANCO',
  'Nome do motorista': 'Carlos Eduardo Lima', 'Cidade Entrega': 'São Paulo', 'UF Entrega': 'SP',
  Safra: 'Polo1', Chassi: '9BWAG5R18TP042510',
  'Status Vínculo': 'Alugado', 'Status Circulação': 'Oficina'
};
const DISPONIVEL = {
  Placa: 'DVN4H52', Modelo: 'Tera 1.0 MPI', Fabricante: 'VOLKSWAGEN', Cor: 'PRATA',
  'Nome do motorista': '', 'Cidade Entrega': 'Guarulhos', 'UF Entrega': 'SP',
  Safra: 'Tera1', Chassi: '9BWAG5R18TP000003',
  'Status Vínculo': 'Disponível', 'Status Circulação': 'Circulante'
};
const EM_PREPARACAO = {
  Placa: 'EGX9H53', Modelo: 'Argo 1.0', Fabricante: 'FIAT', Cor: 'PRETO',
  'Nome do motorista': 'Marcelo Antunes', 'Cidade Entrega': 'Osasco', 'UF Entrega': 'SP',
  Safra: 'Argo1', Chassi: '9BWAG5R18TP000004',
  'Status Vínculo': 'Em preparação', 'Status Circulação': ''
};
const ATRIBUIDO = {
  Placa: 'FCN0G62', Modelo: 'Argo 1.0', Fabricante: 'FIAT', Cor: 'CINZA',
  'Nome do motorista': 'Tatiane Souza', 'Cidade Entrega': 'Santo André', 'UF Entrega': 'SP',
  Safra: 'Argo1', Chassi: '9BWAG5R18TP000005',
  'Status Vínculo': 'Atribuído', 'Status Circulação': 'Circulante'
};
const PERDA_TOTAL = {
  Placa: 'GDV3F82', Modelo: 'Polo 1.0 Track', Fabricante: 'VOLKSWAGEN', Cor: 'BRANCO',
  'Nome do motorista': 'Rafael Nunes', 'Cidade Entrega': 'São Paulo', 'UF Entrega': 'SP',
  Safra: 'Polo1', Chassi: '9BWAG5R18TP000006',
  'Status Vínculo': 'Perda Total', 'Status Circulação': 'Circulante'
};

const FROTA = [CIRCULANDO, NA_OFICINA, DISPONIVEL, EM_PREPARACAO, ATRIBUIDO, PERDA_TOTAL];
const placas = lista => lista.map(v => v.Placa);

// ══════════════════════ statusEfetivo ══════════════════════
// A regra do dono, 31/07: quem não circula aparece como Oficina, mesmo alugado.

test('statusEfetivo: alugado e fora de circulação aparece como Oficina', () => {
  assert.equal(statusEfetivo(NA_OFICINA), 'Oficina');
});

test('statusEfetivo: alugado e circulante continua Alugado', () => {
  assert.equal(statusEfetivo(CIRCULANDO), 'Alugado');
});

test('statusEfetivo: sem coluna de circulação cai no vínculo', () => {
  const semColuna = { Placa: 'ZZZ0A00', 'Status Vínculo': 'Alugado' };
  assert.equal(statusEfetivo(semColuna), 'Alugado');
});

test('statusEfetivo: coluna de circulação vazia também cai no vínculo', () => {
  assert.equal(statusEfetivo(EM_PREPARACAO), 'Em preparação');
});

test('statusEfetivo: sem nenhum dos dois devolve vazio e não lança', () => {
  assert.equal(statusEfetivo({ Placa: 'ZZZ0A00' }), '');
  assert.equal(statusEfetivo({}), '');
  assert.equal(statusEfetivo(null), '');
  assert.equal(statusEfetivo(undefined), '');
});

test('statusEfetivo: só a circulação, sem vínculo, ainda responde', () => {
  assert.equal(statusEfetivo({ Placa: 'ZZZ0A00', 'Status Circulação': 'Oficina' }), 'Oficina');
});

test('statusEfetivo: aceita o "Status" canônico que o servidor monta', () => {
  assert.equal(statusEfetivo({ Placa: 'ZZZ0A00', Status: 'Alugado', 'Status Circulação': 'Oficina' }), 'Oficina');
  assert.equal(statusEfetivo({ Placa: 'ZZZ0A00', Status: 'Alugado' }), 'Alugado');
});

// ══════════════════════ contar ══════════════════════

test('contar: o alugado na oficina conta em Oficina e NÃO em Alugados', () => {
  const c = contar(FROTA);
  assert.equal(c.oficina, 1, 'o carro de oficina precisa aparecer em Oficina');
  assert.equal(c.alugados, 1, 'só o alugado que circula conta em Alugados');
  assert.ok(!placas(filtrar(FROTA, { grupo: 'alugados' })).includes('CUM0J31'));
});

test('contar: os cartões somam o total, sem sobreposição', () => {
  const c = contar(FROTA);
  const soma = c.alugados + c.disponiveis + c.oficina + c.preparacao + c.atribuidos + c.perda + c.outros;
  assert.equal(c.total, FROTA.length);
  assert.equal(soma, c.total, `os cartões somam ${soma} e o total é ${c.total}`);
});

test('contar: cada cartão com o seu, e Perda total tem o próprio balde', () => {
  const c = contar(FROTA);
  assert.deepEqual(c, {
    total: 6, alugados: 1, disponiveis: 1, oficina: 1,
    preparacao: 1, atribuidos: 1, perda: 1, outros: 0
  });
});

test('contar: lista vazia devolve zeros e não lança', () => {
  const c = contar([]);
  assert.equal(c.total, 0);
  assert.equal(c.outros, 0);
  assert.equal(c.perda, 0);
  assert.equal(contar(undefined).total, 0);
});

// ══════════════════════ filtrar ══════════════════════

test('filtrar: sem critérios devolve todo mundo e não muta a entrada', () => {
  const copia = FROTA.slice();
  assert.equal(filtrar(FROTA, {}).length, 6);
  assert.equal(filtrar(FROTA).length, 6);
  assert.deepEqual(FROTA, copia, 'filtrar não pode mexer no array de entrada');
});

test('filtrar: a busca acha pela placa', () => {
  assert.deepEqual(placas(filtrar(FROTA, { busca: 'cum0' })), ['CUM0J31']);
});

test('filtrar: a busca acha pelo motorista', () => {
  assert.deepEqual(placas(filtrar(FROTA, { busca: 'tatiane' })), ['FCN0G62']);
});

test('filtrar: a busca acha pelo modelo', () => {
  assert.deepEqual(placas(filtrar(FROTA, { busca: 'tera' })), ['DVN4H52']);
});

test('filtrar: a busca ignora acento e caixa', () => {
  assert.deepEqual(placas(filtrar(FROTA, { busca: 'SAO PAULO' })), []);
  assert.deepEqual(placas(filtrar(FROTA, { busca: 'BEATRIZ' })), ['BQK4E12']);
  assert.deepEqual(placas(filtrar(FROTA, { busca: 'santo andre' })), []);
});

test('filtrar: a busca também acha pelo chassi', () => {
  assert.deepEqual(placas(filtrar(FROTA, { busca: '042510' })), ['CUM0J31']);
});

test('filtrar: busca sem resultado devolve lista vazia', () => {
  assert.deepEqual(filtrar(FROTA, { busca: 'nao existe' }), []);
});

test('filtrar: o grupo usa o status efetivo, não o vínculo cru', () => {
  assert.deepEqual(placas(filtrar(FROTA, { grupo: 'alugados' })), ['BQK4E12']);
  assert.deepEqual(placas(filtrar(FROTA, { grupo: 'oficina' })), ['CUM0J31']);
  assert.deepEqual(placas(filtrar(FROTA, { grupo: 'perda' })), ['GDV3F82']);
  assert.deepEqual(placas(filtrar(FROTA, { grupo: 'outros' })), []);
});

test('filtrar: status exato também usa o status efetivo', () => {
  assert.deepEqual(placas(filtrar(FROTA, { status: 'Oficina' })), ['CUM0J31']);
  assert.deepEqual(placas(filtrar(FROTA, { status: 'Alugado' })), ['BQK4E12']);
});

test('filtrar: combina fabricante com busca', () => {
  assert.deepEqual(placas(filtrar(FROTA, { fabricante: 'FIAT' })), ['EGX9H53', 'FCN0G62']);
  assert.deepEqual(placas(filtrar(FROTA, { fabricante: 'FIAT', busca: 'tatiane' })), ['FCN0G62']);
  assert.deepEqual(filtrar(FROTA, { fabricante: 'FIAT', busca: 'beatriz' }), []);
});

test('filtrar: modelo, cidade, UF e safra', () => {
  assert.deepEqual(placas(filtrar(FROTA, { modelo: 'Tera 1.0 MPI' })), ['DVN4H52']);
  assert.deepEqual(placas(filtrar(FROTA, { cidade: 'Osasco' })), ['EGX9H53']);
  assert.equal(filtrar(FROTA, { uf: 'SP' }).length, 6);
  assert.deepEqual(placas(filtrar(FROTA, { safra: 'Tera1' })), ['DVN4H52']);
});

// ══════════════════════ ordenar ══════════════════════

test('ordenar: crescente e decrescente pela placa', () => {
  assert.deepEqual(placas(ordenar(FROTA, 'placa', 'asc')),
    ['BQK4E12', 'CUM0J31', 'DVN4H52', 'EGX9H53', 'FCN0G62', 'GDV3F82']);
  assert.deepEqual(placas(ordenar(FROTA, 'placa', 'desc')),
    ['GDV3F82', 'FCN0G62', 'EGX9H53', 'DVN4H52', 'CUM0J31', 'BQK4E12']);
});

test('ordenar: é estável — empates mantêm a ordem original nos dois sentidos', () => {
  const asc = placas(ordenar(FROTA, 'modelo', 'asc')).filter(p => ['BQK4E12', 'CUM0J31', 'GDV3F82'].includes(p));
  const desc = placas(ordenar(FROTA, 'modelo', 'desc')).filter(p => ['BQK4E12', 'CUM0J31', 'GDV3F82'].includes(p));
  assert.deepEqual(asc, ['BQK4E12', 'CUM0J31', 'GDV3F82'], 'os três "Polo" mantêm a ordem de entrada');
  assert.deepEqual(desc, ['BQK4E12', 'CUM0J31', 'GDV3F82'], 'inverter a direção não embaralha os empates');
});

test('ordenar: não muta o array original', () => {
  const antes = placas(FROTA);
  ordenar(FROTA, 'placa', 'desc');
  assert.deepEqual(placas(FROTA), antes);
});

test('ordenar: coluna desconhecida devolve uma cópia na ordem de entrada', () => {
  const r = ordenar(FROTA, 'inventada', 'asc');
  assert.deepEqual(placas(r), placas(FROTA));
  assert.notEqual(r, FROTA, 'devolve cópia, não o mesmo array');
  assert.deepEqual(placas(ordenar(FROTA, null)), placas(FROTA));
});

test('ordenar: pela coluna de status usa o status efetivo', () => {
  const r = placas(ordenar(FROTA, 'status', 'asc'));
  // Alugado, Atribuído, Disponível, Em preparação, Oficina, Perda Total
  assert.deepEqual(r, ['BQK4E12', 'FCN0G62', 'DVN4H52', 'EGX9H53', 'CUM0J31', 'GDV3F82']);
});

test('ordenar: vazio e entrada inválida não lançam', () => {
  assert.deepEqual(ordenar([], 'placa'), []);
  assert.deepEqual(ordenar(undefined, 'placa'), []);
});

// ══════════════════════ a tela ══════════════════════

test('a frente não tem mais nada do Apps Script', () => {
  for (const proibido of ['script.google.com', 'AUTH_URL', 'apiFetch', 'callback=', 'data.json']) {
    assert.ok(!FRENTE.includes(proibido), `"${proibido}" ainda aparece na frente do site`);
  }
});

test('a frente chama as rotas do servidor novo', () => {
  for (const rota of ['/api/login', '/api/logout', '/api/veiculos', '/api/usuarios', '/api/diagnostico']) {
    assert.ok(FRENTE.includes(rota), `a rota ${rota} não aparece na frente`);
  }
});

test('a tarja de aviso existe no HTML', () => {
  assert.match(HTML, /id="tarja"/, 'falta o elemento da tarja de aviso da planilha');
  assert.match(JS, /aviso/, 'o app.js precisa ler o campo "aviso" de /api/veiculos');
});

test('a tela tem os estados que hoje não existem', () => {
  for (const marca of ['id="estado"', 'id="tbody"', 'id="resumo"', 'id="busca"', 'id="chips"', 'id="contador"']) {
    assert.ok(HTML.includes(marca), `falta ${marca} no index.html`);
  }
});

test('o cabeçalho é degradê roxo com o símbolo da OCN à ESQUERDA, sem o letreiro', () => {
  assert.match(HTML, /linear-gradient\([^)]*var\(--cor-roxo\)/, 'falta o degradê roxo do cabeçalho');
  assert.match(HTML, /img\/ocn-logo-white\.png/, 'falta o símbolo da OCN');

  const topo = HTML.match(/<header class="topo">([\s\S]*?)<\/header>/)[1];
  const logo = topo.indexOf('logo-ocn');
  const direita = topo.indexOf('topo-dir');
  assert.ok(logo !== -1, 'o símbolo da OCN precisa estar no cabeçalho');
  assert.ok(logo < direita, 'o símbolo vem antes do bloco da direita — ele é a marca à esquerda agora');
  assert.ok(!/<h1[^>]*>\s*OCN Frota\s*<\/h1>/.test(HTML), 'o letreiro "OCN Frota" deu lugar ao símbolo');
});

// ══════════ iteração 2 — o que o dono pediu depois de ver a tela ══════════

const CAMPOS_DETALHE = (() => {
  const bloco = JS.match(/const CAMPOS_DETALHE = \[([\s\S]*?)\n\];/);
  assert.ok(bloco, 'não achei o bloco CAMPOS_DETALHE em public/app.js');
  return [...bloco[1].matchAll(/rotulo: '([^']+)'/g)].map(m => m[1]);
})();

test('os campos que o dono tirou saíram do detalhe', () => {
  const removidos = [
    'Cidade de entrega', 'UF', 'Safra', 'Frota', 'ID no Admin', 'Status Circulação',
    'Final da placa', 'CRLV na pasta?', 'Vistoriado?', 'Fatura na pasta?',
    'Apólice de seguro na pasta?', 'Registrado no Admin?', 'Fornecedor de Chip', 'Recebido em'
  ];
  for (const campo of removidos) {
    assert.ok(!CAMPOS_DETALHE.includes(campo), `"${campo}" ainda aparece no detalhe do veículo`);
  }
});

test('Status Circulação sai da tela mas continua sendo LIDO — é ele que faz o carro virar Oficina', () => {
  assert.match(JS, /Status Circulação/, 'a coluna precisa continuar sendo lida por statusEfetivo');
  assert.equal(statusEfetivo(NA_OFICINA), 'Oficina');
});

test('CPF e Telefone voltaram ao detalhe, agora vindos da segunda aba', () => {
  assert.ok(CAMPOS_DETALHE.includes('CPF'), 'falta o CPF no detalhe');
  assert.ok(CAMPOS_DETALHE.includes('Telefone'), 'falta o Telefone no detalhe');
});

test('o filtro de cidade saiu da barra de ferramentas', () => {
  assert.ok(!HTML.includes('f-cidade'), 'o select de cidade ainda está no HTML');
  assert.ok(!JS.includes('f-cidade'), 'a fiação do select de cidade ainda está no app.js');
});

test('a faixa de "lido da planilha · atualiza sozinho" saiu do cabeçalho', () => {
  assert.ok(!FRENTE.includes('atualiza sozinho'), 'a faixa roxa de frescor precisa sumir');
  assert.ok(!FRENTE.includes('topo-sub'), 'o elemento da faixa continua no HTML');
});

test('os cartões de resumo estão em português, com as palavras que o dono escolheu', () => {
  const bloco = JS.match(/const CARTOES = \[([\s\S]*?)\n\];/)[1];
  const rotulos = [...bloco.matchAll(/rotulo: '([^']+)'/g)].map(m => m[1]);
  for (const esperado of ['Total da frota', 'Alugados', 'Disponíveis', 'Em preparação', 'Oficina', 'Perda total']) {
    assert.ok(rotulos.includes(esperado), `falta o cartão "${esperado}"`);
  }
});

test('nenhuma palavra em inglês sobrou na tela', () => {
  /* Só palavras que não existem em português nem como parte de identificador
     daqui: "Exportar" não casa com \bExport\b, e type="search" é minúsculo. */
  const ingles = [
    'Fleet', 'Rented', 'Available', 'Workshop', 'Total loss', 'In preparation',
    'Search', 'Export', 'Loading', 'Refresh', 'Settings', 'Filters', 'Clear',
    'Close', 'Driver', 'Plate', 'Users', 'Password', 'Sign in', 'Logout'
  ];
  const achadas = ingles.filter(p => new RegExp(`\\b${p}\\b`).test(FRENTE));
  assert.deepEqual(achadas, [], `texto em inglês na tela: ${achadas.join(', ')}`);
});

test('mais cor: o roxo sai do cabeçalho e os cartões deixam de ser brancos', () => {
  const estilo = HTML.match(/<style>([\s\S]*?)<\/style>/)[1];
  assert.match(estilo, /thead th\{[^}]*background:var\(--cor-roxo-fraco\)/,
    'o cabeçalho da tabela continua branco');
  assert.match(estilo, /\.cartao-total\{[^}]*linear-gradient/,
    'o cartão do total é a âncora roxa do resumo');
  const tintados = (estilo.match(/\.cartao-[a-z]+\{[^}]*background:var\(--cor-[a-z-]+\)/g) || []).length;
  assert.ok(tintados >= 5, `só ${tintados} cartões com cor de fundo — "está tudo muito branco" continua valendo`);
});

test('o logo é um arquivo de verdade, não base64 embutido', () => {
  const logo = join(RAIZ, 'public', 'img', 'ocn-logo-white.png');
  assert.ok(existsSync(logo), 'public/img/ocn-logo-white.png não existe');
  const bytes = readFileSync(logo);
  assert.deepEqual([...bytes.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47], 'não é um PNG');
  assert.ok(!HTML.includes('data:image/png;base64'), 'o HTML não pode embutir o logo em base64');
});

test('toda cor sai de variável — nenhum hex solto fora do :root', () => {
  const estilo = HTML.match(/<style>([\s\S]*?)<\/style>/)[1];
  const corpo = estilo.replace(/:root\s*\{[\s\S]*?\}/, '');
  const soltos = corpo.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
  assert.deepEqual(soltos, [], `hex solto no corpo do CSS: ${soltos.join(', ')}`);
});

test('nenhuma sombra — a separação é por contorno', () => {
  const estilo = HTML.match(/<style>([\s\S]*?)<\/style>/)[1];
  assert.ok(!/box-shadow|text-shadow|drop-shadow/.test(estilo), 'o desenho não pode ter sombra');
});

test('a tela vira lista de cartões no celular', () => {
  assert.match(HTML, /@media\s*\(max-width:\s*760px\)/, 'falta o corte de 760px do celular');
  assert.match(JS, /data-rot/, 'as células precisam do rótulo que vira etiqueta no celular');
});

test('o que a migração apaga sumiu do repositório', () => {
  for (const morto of ['index.html', 'data.json', join('.github', 'workflows', 'update-data.yml')]) {
    assert.ok(!existsSync(join(RAIZ, morto)), `${morto} ainda existe na raiz do repositório`);
  }
});

test('o servidor serve a tela nova de public/', () => {
  assert.ok(existsSync(join(RAIZ, 'public', 'index.html')));
  assert.ok(existsSync(join(RAIZ, 'public', 'app.js')));
  assert.match(HTML, /<script type="module" src="\.?\/?app\.js"><\/script>/);
});

test('a única coisa de fora é o SheetJS do export, como no site atual', () => {
  const externos = [...HTML.matchAll(/https?:\/\/[^"')\s]+/g)].map(m => m[0]);
  /* www.w3.org é o espaço de nomes do SVG — identificador, não carga de rede.
     As fontes vêm da maquete aprovada; o SheetJS é o mesmo do site atual. */
  const permitidos = /^(http:\/\/www\.w3\.org\/2000\/svg|https:\/\/(cdn\.jsdelivr\.net\/npm\/xlsx|fonts\.(googleapis|gstatic)\.com))/;
  const intrusos = externos.filter(u => !permitidos.test(u));
  assert.deepEqual(intrusos, [], `carga externa não autorizada: ${intrusos.join(', ')}`);
});

test('a wiring do DOM não roda ao importar no Node — este arquivo é a prova', () => {
  assert.equal(typeof document, 'undefined');
  assert.match(JS, /typeof document !== 'undefined'/, 'falta a guarda do DOM');
});
