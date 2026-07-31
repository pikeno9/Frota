/* Tela de veículos da frota OCN.
 *
 * A metade de cima é pura: entra dado, sai dado, nada toca o DOM. É o que o
 * Node importa e testa. A metade de baixo é a fiação com a tela e só acorda
 * quando existe um document — por isso dá para testar a regra de negócio sem
 * navegador e sem biblioteca de DOM.
 */

// ═══════════════════════════════════════════════════════════════════
//  PARTE PURA
// ═══════════════════════════════════════════════════════════════════

/* Mesma normalização do servidor: sem acento, sem pontuação de cabeçalho,
   espaço colapsado, minúscula. Permite comparar "Status Circulação" com
   "status circulacao" sem depender de como a planilha escreveu hoje. */
export function chave(v) {
  return String(v ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[?:.]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/* O veículo chega com os nomes de coluna da própria planilha mais as chaves
   canônicas. Procurar por apelido evita que uma renomeação na planilha apague
   um campo da tela silenciosamente. */
export function valorDe(veiculo, ...apelidos) {
  if (!veiculo || typeof veiculo !== 'object') return '';
  for (const a of apelidos) {
    const v = veiculo[a];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  const alvos = apelidos.map(chave);
  for (const k of Object.keys(veiculo)) {
    if (!alvos.includes(chave(k))) continue;
    const v = veiculo[k];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

/* Diferente de valorDe: responde "a planilha tem essa coluna?", mesmo vazia.
   É o que impede a tela de inventar campos — foi assim que CPF e Telefone
   ficaram anos aparecendo como "—" depois de sumirem da planilha. */
export function temColuna(veiculo, ...apelidos) {
  if (!veiculo || typeof veiculo !== 'object') return false;
  const alvos = apelidos.map(chave);
  return Object.keys(veiculo).some(k => alvos.includes(chave(k)));
}

const CIRCULACAO = ['Status Circulação', 'Status Circulacao', 'Circulação', 'Situação de Circulação'];
const VINCULO = ['Status Vínculo', 'Status Vinculo', 'Status', 'Situação'];

/* A REGRA DO DONO (31/07/2026): quem não está circulando aparece como Oficina,
   mesmo estando alugado. Para quem opera a frota, "o carro está na oficina" é o
   fato que importa; o contrato é secundário. O detalhe do veículo continua
   mostrando as duas colunas separadas, para ninguém perder a informação. */
export function statusEfetivo(veiculo) {
  const circulacao = valorDe(veiculo, ...CIRCULACAO);
  if (circulacao && chave(circulacao) !== 'circulante') return circulacao;
  return valorDe(veiculo, ...VINCULO);
}

/* Os baldes dos cartões de resumo. São exaustivos de propósito: "outros"
   garante que a soma dos cartões seja sempre o total, sem sobreposição. */
export function grupoDe(status) {
  const s = chave(status);
  if (!s) return 'outros';
  if (s.includes('oficina') || s.includes('manutenc')) return 'oficina';
  if (s.includes('alugado')) return 'alugados';
  if (s.includes('disponiv')) return 'disponiveis';
  if (s.includes('prepara')) return 'preparacao';
  if (s.includes('atribuid')) return 'atribuidos';
  if (s.includes('perda')) return 'perda';
  return 'outros';
}

export function contar(veiculos) {
  const c = { total: 0, alugados: 0, disponiveis: 0, oficina: 0, preparacao: 0, atribuidos: 0, perda: 0, outros: 0 };
  for (const v of Array.isArray(veiculos) ? veiculos : []) {
    c.total++;
    c[grupoDe(statusEfetivo(v))]++;
  }
  return c;
}

export function classeStatus(status) {
  const s = chave(status);
  if (!s) return 's-cinza';
  if (s.includes('disponiv')) return 's-verde';
  if (s.includes('alugado')) return 's-vermelho';
  if (s.includes('oficina') || s.includes('manutenc')) return 's-lilas';
  if (s.includes('prepara')) return 's-ambar';
  if (s.includes('atribuid')) return 's-azul';
  if (s.includes('perda')) return 's-preto';
  if (s.includes('sinistro')) return 's-vermelho';
  return 's-cinza';
}

const CAMPOS_BUSCA = [
  ['Placa'],
  ['Nome do motorista', 'Motorista', 'Condutor', 'Locatário'],
  ['Modelo'],
  ['Chassi'],
  ['Fabricante', 'Marca']
];

export function filtrar(veiculos, criterios = {}) {
  const lista = Array.isArray(veiculos) ? veiculos : [];
  const termo = chave(criterios.busca);
  const igual = (v, apelidos, alvo) => !alvo || chave(valorDe(v, ...apelidos)) === chave(alvo);

  return lista.filter(v => {
    if (termo && !CAMPOS_BUSCA.some(a => chave(valorDe(v, ...a)).includes(termo))) return false;
    const efetivo = statusEfetivo(v);
    if (criterios.status && chave(efetivo) !== chave(criterios.status)) return false;
    if (criterios.grupo && grupoDe(efetivo) !== criterios.grupo) return false;
    if (!igual(v, ['Fabricante', 'Marca'], criterios.fabricante)) return false;
    if (!igual(v, ['Modelo'], criterios.modelo)) return false;
    if (!igual(v, ['Cidade Entrega', 'Cidade'], criterios.cidade)) return false;
    if (!igual(v, ['UF Entrega', 'UF'], criterios.uf)) return false;
    if (!igual(v, ['Safra'], criterios.safra)) return false;
    return true;
  });
}

export const COLUNAS = {
  placa: { rotulo: 'Placa', apelidos: ['Placa'] },
  modelo: { rotulo: 'Modelo', apelidos: ['Modelo'] },
  fabricante: { rotulo: 'Fabricante', apelidos: ['Fabricante', 'Marca'] },
  cor: { rotulo: 'Cor', apelidos: ['Cor'] },
  motorista: { rotulo: 'Motorista', apelidos: ['Nome do motorista', 'Motorista', 'Condutor'] },
  cidade: { rotulo: 'Cidade', apelidos: ['Cidade Entrega', 'Cidade'] },
  status: { rotulo: 'Status', apelidos: null }   // sai de statusEfetivo
};

/* Estável de propósito: o desempate é a posição de entrada, não a direção. Sem
   isso, clicar em "Modelo" embaralharia a ordem por placa a cada clique e a
   equipe perderia a referência visual da linha que estava lendo. */
export function ordenar(veiculos, coluna, direcao = 'asc') {
  const lista = Array.isArray(veiculos) ? veiculos.slice() : [];
  if (!coluna || !Object.hasOwn(COLUNAS, coluna)) return lista;
  const sinal = direcao === 'desc' ? -1 : 1;
  const def = COLUNAS[coluna];
  const chaveDe = def.apelidos ? v => valorDe(v, ...def.apelidos) : statusEfetivo;

  return lista
    .map((v, i) => ({ v, i, k: chaveDe(v) }))
    .sort((a, b) =>
      (a.k.localeCompare(b.k, 'pt-BR', { numeric: true, sensitivity: 'base' }) * sinal) || (a.i - b.i))
    .map(x => x.v);
}

export function formatarQuando(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const hoje = new Date();
  const ontem = new Date(hoje);
  ontem.setDate(hoje.getDate() - 1);
  if (d.toDateString() === hoje.toDateString()) return `hoje às ${hora}`;
  if (d.toDateString() === ontem.toDateString()) return `ontem às ${hora}`;
  return `${d.toLocaleDateString('pt-BR')} às ${hora}`;
}

/* A frase do estado "sem resultado" precisa dizer QUAL combinação não achou
   nada — "nenhum veículo encontrado" sozinho não ajuda ninguém a se desfazer
   do filtro que sobrou de ontem. */
export function descreverCriterios(criterios = {}, rotulosGrupo = {}) {
  const partes = [];
  if (criterios.busca) partes.push(`“${criterios.busca}”`);
  if (criterios.grupo) partes.push(`grupo ${rotulosGrupo[criterios.grupo] ?? criterios.grupo}`);
  if (criterios.status) partes.push(`status ${criterios.status}`);
  if (criterios.fabricante) partes.push(`fabricante ${criterios.fabricante}`);
  if (criterios.modelo) partes.push(`modelo ${criterios.modelo}`);
  if (criterios.uf) partes.push(`UF ${criterios.uf}`);
  if (criterios.safra) partes.push(`safra ${criterios.safra}`);
  if (partes.length === 0) return '';
  if (partes.length === 1) return partes[0];
  return partes.slice(0, -1).join(', ') + ' e ' + partes[partes.length - 1];
}

export function opcoesDe(veiculos, apelidos) {
  const vistos = new Map();
  for (const v of Array.isArray(veiculos) ? veiculos : []) {
    const valor = valorDe(v, ...apelidos);
    if (valor && !vistos.has(chave(valor))) vistos.set(chave(valor), valor);
  }
  return [...vistos.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

// ═══════════════════════════════════════════════════════════════════
//  FIAÇÃO COM A TELA — daqui para baixo só roda no navegador
// ═══════════════════════════════════════════════════════════════════

const ICONE = {
  atualizar: '<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/>',
  admin: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6h.09A1.65 1.65 0 0 0 10.6 3.09V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  copiar: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  ok: '<path d="m5 12 5 5L20 7"/>',
  baixo: '<path d="m6 9 6 6 6-6"/>',
  cima: '<path d="m18 15-6-6-6 6"/>',
  sobe: '<path d="m6 15 6-6 6 6"/>',
  lupa: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  carro: '<path d="M5 17h14l-1.5-5.5a2 2 0 0 0-1.9-1.5H8.4a2 2 0 0 0-1.9 1.5z"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="16.5" cy="17.5" r="1.5"/>',
  elo: '<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
  alerta: '<path d="M12 8v5"/><path d="M12 17h.01"/><circle cx="12" cy="12" r="9"/>',
  fechar: '<path d="M18 6 6 18M6 6l12 12"/>'
};

function svg(caminho, tamanho = 15) {
  return `<svg width="${tamanho}" height="${tamanho}" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${caminho}</svg>`;
}

/* Tudo que vem da planilha entra por textContent. Nome de motorista é dado de
   terceiro: montar linha com innerHTML seria injetar HTML de planilha na tela. */
function el(tag, props = {}, ...filhos) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : String(v));
  }
  for (const f of filhos.flat()) if (f != null && f !== false) n.append(f);
  return n;
}

/* Rótulos na ordem e nas palavras que o dono escolheu (31/07). Tudo em pt-BR:
   a tela é lida por quem opera a frota, não por quem programa. */
const CARTOES = [
  { chave: 'total', rotulo: 'Total da frota' },
  { chave: 'alugados', rotulo: 'Alugados' },
  { chave: 'disponiveis', rotulo: 'Disponíveis' },
  { chave: 'preparacao', rotulo: 'Em preparação' },
  { chave: 'oficina', rotulo: 'Oficina' },
  { chave: 'perda', rotulo: 'Perda total' },
  { chave: 'atribuidos', rotulo: 'Atribuídos' },
  { chave: 'outros', rotulo: 'Outros' }
];
/* Estes dois só aparecem quando existem: numa frota sem nenhum carro atribuído,
   um cartão zerado é ruído. Os seis do dono ficam sempre à vista. */
const CARTOES_SOB_DEMANDA = ['atribuidos', 'outros'];
const ROTULO_GRUPO = Object.fromEntries(CARTOES.map(c => [c.chave, c.rotulo]));

const CHAVE_PREFS = 'frota:preferencias';
const CHAVE_USUARIO = 'frota:usuario';
const MINUTOS_RECARGA = 5;

/* Sem "cidade": o dono tirou esse filtro em 31/07. filtrar() continua sabendo
   filtrar por cidade — quem some é o controle na tela. */
const CRITERIOS_VAZIOS = () =>
  ({ busca: '', status: '', grupo: '', fabricante: '', modelo: '', uf: '', safra: '' });

const SELECTS = { 'f-status': 'status', 'f-fabricante': 'fabricante', 'f-modelo': 'modelo', 'f-uf': 'uf', 'f-safra': 'safra' };

const estado = {
  veiculos: [],
  lidoEm: null,
  aviso: null,
  usuario: null,
  admin: false,
  criterios: CRITERIOS_VAZIOS(),
  ordem: { coluna: 'placa', direcao: 'asc' },
  densidade: 'compacto',
  aberta: null,
  visiveis: []
};

class ErroApi extends Error {
  constructor(status, mensagem) { super(mensagem); this.status = status; }
}

async function pedir(rota, opcoes = {}) {
  let r;
  try {
    r = await fetch(rota, {
      credentials: 'same-origin',
      headers: opcoes.body ? { 'Content-Type': 'application/json' } : undefined,
      ...opcoes
    });
  } catch {
    throw new ErroApi(0, 'Não consegui falar com o servidor. Verifique a conexão.');
  }
  let corpo = null;
  try { corpo = await r.json(); } catch { /* resposta sem corpo */ }
  if (!r.ok) throw new ErroApi(r.status, corpo?.erro || corpo?.msg || 'Erro inesperado.');
  return corpo;
}

/* Qualquer 401 fora do login significa "a sessão de 8 horas venceu". Volta para
   a entrada sem apagar os filtros: quem estava no meio de uma triagem não perde
   o recorte que montou. */
async function pedirLogado(rota, opcoes) {
  try {
    return await pedir(rota, opcoes);
  } catch (e) {
    if (e.status === 401) sessaoExpirou();
    throw e;
  }
}

const $ = id => document.getElementById(id);
let temporizadorBusca = null;
let temporizadorRecarga = null;
const cacheLinhas = new WeakMap();

// ── preferências ──────────────────────────────────────────────────
function guardarPrefs() {
  try {
    const { busca, ...resto } = estado.criterios;
    localStorage.setItem(CHAVE_PREFS, JSON.stringify({
      criterios: resto, ordem: estado.ordem, densidade: estado.densidade
    }));
  } catch { /* modo privado: preferir a tela funcionando a explodir aqui */ }
}

function lerPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(CHAVE_PREFS) || '{}');
    /* Só entram critérios que ainda existem. Sem isso, um filtro de cidade
       guardado antes de 31/07 continuaria filtrando sem controle na tela. */
    for (const k of Object.keys(estado.criterios)) {
      if (k !== 'busca' && p.criterios?.[k]) estado.criterios[k] = p.criterios[k];
    }
    if (p.ordem?.coluna) estado.ordem = p.ordem;
    if (p.densidade) estado.densidade = p.densidade;
  } catch { /* preferência corrompida não pode impedir o login */ }
}

// ── login ─────────────────────────────────────────────────────────
function mostrarLogin(mensagem = '') {
  $('tela-login').hidden = false;
  $('tela-app').hidden = true;
  $('login-erro').textContent = mensagem;
  $('login-senha').value = '';
  $('login-usuario').focus();
}

function mostrarApp() {
  $('tela-login').hidden = true;
  $('tela-app').hidden = false;
  $('topo-nome').textContent = estado.usuario ?? '';
  $('topo-papel').textContent = estado.admin ? 'Administrador' : 'Colaborador';
  $('btn-admin').hidden = !estado.admin;
}

/* Esquece QUEM estava e O QUE estava na tela, mas guarda os critérios: quem
   sai não pode deixar a frota carregada para o próximo que entrar no mesmo
   navegador, e quem só perdeu a sessão não merece remontar o filtro. */
function esquecerSessao() {
  estado.usuario = null;
  estado.admin = false;
  estado.veiculos = [];
  estado.visiveis = [];
  estado.lidoEm = null;
  estado.aviso = null;
  estado.aberta = null;
  try { localStorage.removeItem(CHAVE_USUARIO); } catch { /* sem storage */ }
  pararRecarga();
}

function sessaoExpirou() {
  if ($('tela-login').hidden === false) return;
  esquecerSessao();
  mostrarLogin('Sua sessão expirou. Entre de novo — seus filtros continuam aqui.');
}

async function entrar(ev) {
  ev.preventDefault();
  const usuario = $('login-usuario').value.trim();
  const senha = $('login-senha').value;
  const erro = $('login-erro');
  const botao = $('login-entrar');
  erro.textContent = '';
  if (!usuario || !senha) { erro.textContent = 'Preencha usuário e senha.'; return; }
  botao.disabled = true;
  botao.textContent = 'Entrando…';
  try {
    const r = await pedir('/api/login', { method: 'POST', body: JSON.stringify({ usuario, senha }) });
    estado.usuario = r.usuario;
    estado.admin = !!r.admin;
    try { localStorage.setItem(CHAVE_USUARIO, JSON.stringify(r)); } catch { /* sem storage */ }
    mostrarApp();
    await carregar();
    iniciarRecarga();
  } catch (e) {
    erro.textContent = e.message;
  } finally {
    botao.disabled = false;
    botao.textContent = 'Entrar';
  }
}

async function sair() {
  try { await pedir('/api/logout', { method: 'POST' }); } catch { /* sair sempre sai */ }
  esquecerSessao();
  $('tbody').replaceChildren();
  mostrarLogin();
}

// ── dados ─────────────────────────────────────────────────────────
function iniciarRecarga() {
  pararRecarga();
  temporizadorRecarga = setInterval(() => {
    if (!document.hidden) carregar({ silencioso: true });
  }, MINUTOS_RECARGA * 60_000);
}

function pararRecarga() {
  if (temporizadorRecarga) clearInterval(temporizadorRecarga);
  temporizadorRecarga = null;
}

async function carregar({ silencioso = false } = {}) {
  const botao = $('btn-atualizar');
  if (!silencioso && !estado.veiculos.length) mostrarEstado('carregando');
  botao.disabled = true;
  try {
    const r = await pedirLogado('/api/veiculos');
    estado.veiculos = Array.isArray(r.veiculos) ? r.veiculos : [];
    estado.lidoEm = r.lidoEm ?? null;
    estado.aviso = r.aviso ?? null;
    popularFiltros();
    renderizar();
    abrirDoEndereco();
  } catch (e) {
    if (e.status === 401) return;
    /* 503 = não leu a planilha E não existe cópia anterior. Com cópia, o
       servidor devolve 200 com "aviso" e a tabela continua de pé. */
    if (estado.veiculos.length) {
      anunciar('Não consegui atualizar agora. Continuo mostrando a última leitura.');
    } else {
      mostrarEstado('erro', e.message);
    }
  } finally {
    botao.disabled = false;
  }
}

// ── filtros ───────────────────────────────────────────────────────
function popularFiltros() {
  const listas = {
    'f-status': [opcoesDeStatus(), 'Todos os status', 'status'],
    'f-fabricante': [opcoesDe(estado.veiculos, ['Fabricante', 'Marca']), 'Todos os fabricantes', 'fabricante'],
    'f-modelo': [opcoesDe(estado.veiculos, ['Modelo']), 'Todos os modelos', 'modelo'],
    'f-uf': [opcoesDe(estado.veiculos, ['UF Entrega', 'UF']), 'Todas as UFs', 'uf'],
    'f-safra': [opcoesDe(estado.veiculos, ['Safra']), 'Todas as safras', 'safra']
  };
  for (const [id, [valores, rotuloVazio, criterio]] of Object.entries(listas)) {
    const sel = $(id);
    sel.replaceChildren(
      el('option', { value: '', text: rotuloVazio }),
      ...valores.map(v => el('option', { value: v, text: v }))
    );
    /* Um filtro salvo que não existe mais na planilha vira filtro fantasma:
       zero resultados sem nada selecionado à vista. Some com ele. */
    if (estado.criterios[criterio] && !valores.some(v => chave(v) === chave(estado.criterios[criterio]))) {
      estado.criterios[criterio] = '';
    }
    sel.value = estado.criterios[criterio] || '';
  }
}

function opcoesDeStatus() {
  const vistos = new Map();
  for (const v of estado.veiculos) {
    const s = statusEfetivo(v);
    if (s && !vistos.has(chave(s))) vistos.set(chave(s), s);
  }
  return [...vistos.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function limparFiltros() {
  estado.criterios = CRITERIOS_VAZIOS();
  $('busca').value = '';
  for (const id of Object.keys(SELECTS)) $(id).value = '';
  guardarPrefs();
  renderizar();
}

// ── desenho ───────────────────────────────────────────────────────
function renderizar() {
  estado.visiveis = ordenar(
    filtrar(estado.veiculos, estado.criterios),
    estado.ordem.coluna, estado.ordem.direcao
  );
  desenharTarja();
  desenharResumo();
  desenharChips();
  desenharCabecalho();
  desenharCorpo();
  /* O frescor saiu da faixa roxa do cabeçalho (31/07) e virou uma linha discreta
     ao lado do contador: quem quiser saber, sabe; quem não quiser, não tropeça. */
  $('frescor').textContent = estado.lidoEm ? `Lido da planilha ${formatarQuando(estado.lidoEm)}` : '';
  $('btn-exportar-texto').textContent = estado.visiveis.length === estado.veiculos.length
    ? `Exportar os ${estado.veiculos.length}`
    : `Exportar os ${estado.visiveis.length} filtrados`;
  $('btn-exportar').disabled = estado.visiveis.length === 0;
}

function desenharTarja() {
  const tarja = $('tarja');
  if (!estado.aviso) { tarja.hidden = true; return; }
  tarja.hidden = false;
  const desde = formatarQuando(estado.aviso.desde);
  $('tarja-texto').replaceChildren(
    el('b', { text: `A planilha está com um problema${desde ? ' desde ' + desde : ''}` }),
    document.createTextNode(` — ${estado.aviso.motivo}. Os dados abaixo são da última leitura boa, de ${formatarQuando(estado.lidoEm) || 'antes'}.`)
  );
}

function desenharResumo() {
  const c = contar(estado.veiculos);
  const resumo = $('resumo');
  resumo.replaceChildren(...CARTOES.filter(def => !CARTOES_SOB_DEMANDA.includes(def.chave) || c[def.chave] > 0).map(def => {
    const ativo = def.chave === 'total' ? !estado.criterios.grupo : estado.criterios.grupo === def.chave;
    return el('button', {
      class: `cartao cartao-${def.chave}`, type: 'button', 'aria-pressed': String(ativo),
      onclick: () => {
        estado.criterios.grupo = def.chave === 'total' || estado.criterios.grupo === def.chave ? '' : def.chave;
        guardarPrefs();
        renderizar();
      }
    },
      el('span', { class: 'rotulo' },
        el('span', { class: `ponto ponto-${def.chave}` }),
        document.createTextNode(def.rotulo)),
      el('span', { class: 'valor', text: String(c[def.chave]) })
    );
  }));
}

function desenharChips() {
  const rotulos = {
    busca: 'Busca', grupo: 'Grupo', status: 'Status', fabricante: 'Fabricante',
    modelo: 'Modelo', uf: 'UF', safra: 'Safra'
  };
  const ativos = Object.entries(estado.criterios).filter(([, v]) => v);
  $('contador').replaceChildren(
    document.createTextNode('Mostrando '),
    el('b', { text: String(estado.visiveis.length) }),
    document.createTextNode(` de ${estado.veiculos.length} veículos`)
  );
  $('chips').replaceChildren(...ativos.map(([k, v]) =>
    el('span', { class: 'chip' },
      document.createTextNode(`${rotulos[k]}: ${k === 'grupo' ? ROTULO_GRUPO[v] ?? v : v}`),
      el('button', {
        type: 'button', 'aria-label': `Remover o filtro ${rotulos[k]}`,
        html: svg(ICONE.fechar, 13),
        onclick: () => {
          estado.criterios[k] = '';
          if (k === 'busca') $('busca').value = '';
          const sel = $('f-' + k);
          if (sel) sel.value = '';
          guardarPrefs();
          renderizar();
        }
      })
    )
  ));
  $('btn-limpar').hidden = ativos.length === 0;
}

function desenharCabecalho() {
  for (const th of document.querySelectorAll('#tabela thead th[data-col]')) {
    const col = th.dataset.col;
    const ativa = estado.ordem.coluna === col;
    if (ativa) th.setAttribute('aria-sort', estado.ordem.direcao === 'asc' ? 'ascending' : 'descending');
    else th.removeAttribute('aria-sort');
    th.querySelector('.seta').innerHTML = ativa ? svg(estado.ordem.direcao === 'asc' ? ICONE.sobe : ICONE.baixo, 13) : '';
  }
}

function desenharCorpo() {
  if (!estado.visiveis.length) {
    mostrarEstado('vazio');
    return;
  }
  mostrarEstado('tabela');
  const tbody = $('tbody');
  const frag = document.createDocumentFragment();
  for (const v of estado.visiveis) {
    frag.append(linhaDe(v));
    if (estado.aberta && chave(valorDe(v, 'Placa')) === chave(estado.aberta)) frag.append(detalheDe(v));
  }
  /* As <tr> vêm do cache e são movidas, não reconstruídas: digitar na busca
     reordena nós existentes em vez de reescrever 170 linhas de HTML. */
  tbody.replaceChildren(frag);
  $('tabela').className = 'densidade-' + estado.densidade;
}

function linhaDe(veiculo) {
  const guardada = cacheLinhas.get(veiculo);
  if (guardada) {
    atualizarAbertura(guardada, veiculo);
    return guardada;
  }
  const placa = valorDe(veiculo, 'Placa');
  const status = statusEfetivo(veiculo);
  const cidade = valorDe(veiculo, 'Cidade Entrega', 'Cidade');
  const uf = valorDe(veiculo, 'UF Entrega', 'UF');

  const tr = el('tr', {
    class: 'linha', 'data-placa': placa,
    onclick: ev => { if (!ev.target.closest('button')) alternarDetalhe(placa); }
  },
    el('td', { 'data-rot': 'Placa' },
      el('span', { class: 'placa' },
        el('span', { class: 'mono', text: placa || '—' }),
        botaoCopiar(placa, `Copiar a placa ${placa}`))),
    el('td', { 'data-rot': 'Modelo', text: valorDe(veiculo, 'Modelo') || '—' }),
    el('td', { 'data-rot': 'Fabricante', text: valorDe(veiculo, 'Fabricante', 'Marca') || '—' }),
    el('td', { 'data-rot': 'Cor', text: valorDe(veiculo, 'Cor') || '—' }),
    el('td', { 'data-rot': 'Motorista', text: valorDe(veiculo, 'Nome do motorista', 'Motorista') || '—' }),
    el('td', { 'data-rot': 'Cidade' },
      document.createTextNode(cidade || '—'),
      uf ? el('span', { class: 'fraco', text: ' ' + uf }) : null),
    el('td', { 'data-rot': 'Status' },
      el('span', { class: 'selo ' + classeStatus(status), text: status || '—' })),
    el('td', { class: 'celula-abrir' },
      el('button', {
        class: 'abrir', type: 'button',
        'aria-expanded': 'false',
        'aria-label': `Abrir os detalhes do veículo ${placa}`,
        html: svg(ICONE.baixo),
        onclick: () => alternarDetalhe(placa)
      }))
  );
  cacheLinhas.set(veiculo, tr);
  atualizarAbertura(tr, veiculo);
  return tr;
}

function atualizarAbertura(tr, veiculo) {
  const aberta = estado.aberta && chave(valorDe(veiculo, 'Placa')) === chave(estado.aberta);
  tr.classList.toggle('aberta', !!aberta);
  const botao = tr.querySelector('.abrir');
  botao.setAttribute('aria-expanded', aberta ? 'true' : 'false');
  botao.innerHTML = svg(aberta ? ICONE.cima : ICONE.baixo);
}

function botaoCopiar(texto, rotulo, sempreVisivel = false) {
  return el('button', {
    class: 'copiar' + (sempreVisivel ? ' fixa' : ''), type: 'button',
    'aria-label': rotulo, title: rotulo,
    html: svg(ICONE.copiar, 13),
    onclick: ev => copiar(texto, ev.currentTarget)
  });
}

async function copiar(texto, botao) {
  if (!texto) return;
  let deu = false;
  try {
    await navigator.clipboard.writeText(texto);
    deu = true;
  } catch {
    /* clipboard exige HTTPS ou permissão; o caminho velho ainda funciona */
    const caixa = el('textarea', { value: texto, class: 'fora-da-tela' });
    document.body.append(caixa);
    caixa.select();
    try { deu = document.execCommand('copy'); } catch { deu = false; }
    caixa.remove();
  }
  anunciar(deu ? `Copiado: ${texto}` : 'Não consegui copiar.');
  if (deu && botao) {
    botao.classList.add('copiado');
    botao.innerHTML = svg(ICONE.ok, 13);
    setTimeout(() => {
      botao.classList.remove('copiado');
      botao.innerHTML = svg(ICONE.copiar, 13);
    }, 1200);
  }
}

/* Ordem fixa, e o campo só entra se a COLUNA existir na planilha. Mostrar
   "CPF —" para uma coluna que não existe é mentira de tela — por isso o servidor
   só põe CPF e Telefone nos veículos quando conseguiu ler a segunda aba. Lida a
   aba, os dois campos aparecem em TODO veículo: o traço aí quer dizer "a
   planilha não tem esse telefone", que é o caso de metade da frota.
   O dono cortou 14 campos em 31/07 (cidade, UF, safra, frota, os "na pasta?",
   Status Circulação…). Status Circulação continua sendo LIDO por statusEfetivo
   — é ele que faz o carro alugado aparecer como Oficina —, só não é exibido. */
const CAMPOS_DETALHE = [
  { rotulo: 'Placa', apelidos: ['Placa'], mono: true, copiar: true },
  { rotulo: 'Chassi', apelidos: ['Chassi'], mono: true, copiar: true },
  { rotulo: 'Renavam', apelidos: ['Renavam'], mono: true },
  { rotulo: 'Fabricante', apelidos: ['Fabricante', 'Marca'] },
  { rotulo: 'Modelo', apelidos: ['Modelo'] },
  { rotulo: 'Cor', apelidos: ['Cor'] },
  { rotulo: 'Ano do veículo', apelidos: ['Ano Veículo'] },
  { rotulo: 'Ano do modelo', apelidos: ['Ano Modelo'] },
  { rotulo: 'Motorista', apelidos: ['Nome do motorista', 'Motorista'] },
  { rotulo: 'CPF', apelidos: ['CPF'], mono: true, copiar: true },
  { rotulo: 'Telefone', apelidos: ['Telefone'], mono: true, copiar: true },
  { rotulo: 'Status Vínculo', apelidos: VINCULO, selo: true },
  { rotulo: 'Dia do rodízio', apelidos: ['Dia do rodízio'] }
];

function detalheDe(veiculo) {
  const placa = valorDe(veiculo, 'Placa');
  const grade = el('div', { class: 'grade' });

  for (const campo of CAMPOS_DETALHE) {
    if (!temColuna(veiculo, ...campo.apelidos)) continue;
    const valor = valorDe(veiculo, ...campo.apelidos);
    const caixa = el('div', { class: 'val' });
    if (campo.selo) {
      caixa.append(el('span', { class: 'selo ' + classeStatus(valor), text: valor || '—' }));
    } else {
      caixa.append(el('span', { class: campo.mono ? 'mono' : '', text: valor || '—' }));
    }
    if (campo.copiar && valor) caixa.append(botaoCopiar(valor, `Copiar ${campo.rotulo.toLowerCase()}`, true));
    grade.append(el('div', { class: 'campo-det' }, el('div', { class: 'rot', text: campo.rotulo }), caixa));
  }

  const painel = el('div', { class: 'detalhe' },
    el('h3', {}, el('span', { class: 'icone-linha', html: svg(ICONE.carro, 16) }),
      document.createTextNode('Informações do veículo')),
    grade,
    el('div', { class: 'acoes-det' },
      el('button', {
        class: 'btn', type: 'button',
        html: svg(ICONE.elo) + '<span>Copiar link deste veículo</span>',
        onclick: () => copiar(linkDo(placa))
      }),
      el('button', {
        class: 'btn', type: 'button', text: 'Copiar tudo',
        onclick: () => copiar(textoDe(veiculo))
      }),
      el('button', {
        class: 'btn', type: 'button', text: 'Fechar',
        onclick: () => alternarDetalhe(placa)
      }))
  );

  return el('tr', { class: 'linha-detalhe' },
    el('td', { class: 'celula-detalhe', colspan: '8', id: 'detalhe-aberto' }, painel));
}

function linkDo(placa) {
  return `${location.origin}${location.pathname}?placa=${encodeURIComponent(placa)}`;
}

function textoDe(veiculo) {
  return CAMPOS_DETALHE
    .filter(c => temColuna(veiculo, ...c.apelidos))
    .map(c => `${c.rotulo}: ${valorDe(veiculo, ...c.apelidos) || '—'}`)
    .join('\n');
}

function alternarDetalhe(placa) {
  estado.aberta = chave(estado.aberta) === chave(placa) ? null : placa;
  desenharCorpo();
  const linha = document.querySelector(`#tbody tr[data-placa="${CSS.escape(placa)}"]`);
  linha?.querySelector('.abrir')?.focus();
}

function abrirDoEndereco() {
  const alvo = new URLSearchParams(location.search).get('placa');
  if (!alvo) return;
  const achou = estado.veiculos.find(v => chave(valorDe(v, 'Placa')) === chave(alvo));
  if (!achou) {
    anunciar(`Não achei o veículo de placa ${alvo}.`);
    history.replaceState(null, '', location.pathname);
    return;
  }
  /* Link direto tem que abrir o carro, e não a interseção do link com o filtro
     que a pessoa deixou salvo — senão o link "não funciona" sem explicação. */
  estado.criterios = CRITERIOS_VAZIOS();
  $('busca').value = '';
  for (const id of Object.keys(SELECTS)) $(id).value = '';
  estado.aberta = valorDe(achou, 'Placa');
  renderizar();
  history.replaceState(null, '', location.pathname);
  document.querySelector(`#tbody tr[data-placa="${CSS.escape(estado.aberta)}"]`)
    ?.scrollIntoView({ block: 'center' });
}

// ── estados da tela ───────────────────────────────────────────────
function mostrarEstado(qual, mensagem = '') {
  const painel = $('estado');
  $('painel-tabela').hidden = qual !== 'tabela';
  painel.hidden = qual === 'tabela';
  if (qual === 'tabela') return;

  if (qual === 'carregando') {
    painel.replaceChildren(el('div', { class: 'esqueleto', 'aria-busy': 'true' },
      ...Array.from({ length: 6 }, () => el('div', { class: 'barra' })),
      el('p', { class: 'fraco centro', text: 'Lendo a planilha…' })));
    return;
  }

  if (qual === 'vazio') {
    const combinacao = descreverCriterios(estado.criterios, ROTULO_GRUPO);
    painel.replaceChildren(el('div', { class: 'vazio' },
      el('div', { class: 'icone', html: svg(ICONE.lupa, 20) }),
      el('h3', { text: 'Nenhum veículo encontrado' }),
      el('p', {
        text: combinacao
          ? `Nenhum dos ${estado.veiculos.length} veículos bate com ${combinacao} ao mesmo tempo.`
          : 'A planilha voltou sem nenhum veículo.'
      }),
      combinacao ? el('button', { class: 'btn', type: 'button', text: 'Limpar os filtros', onclick: limparFiltros }) : null));
    return;
  }

  painel.replaceChildren(el('div', { class: 'vazio' },
    el('div', { class: 'icone icone-erro', html: svg(ICONE.alerta, 20) }),
    el('h3', { text: 'Não consegui ler a planilha' }),
    el('p', { text: mensagem || 'E não existe leitura anterior guardada para mostrar.' }),
    el('button', { class: 'btn', type: 'button', text: 'Tentar de novo', onclick: () => carregar() })));
}

function anunciar(texto) {
  const zona = $('avisos');
  zona.textContent = texto;
  setTimeout(() => { if (zona.textContent === texto) zona.textContent = ''; }, 4000);
}

// ── exportar ──────────────────────────────────────────────────────
const SUBSTATUS = {
  'alugado': 'EM CONTRATO',
  'oficina': 'EM MANUTENÇÃO',
  'atribuido': 'RESERVADO',
  'disponivel': 'DISPONÍVEL LOCAÇÃO',
  'em preparacao': 'VISTORIA VEICULAR',
  'perda total': 'VENDIDO'
};

function exportar() {
  const XLSX = globalThis.XLSX;
  if (!XLSX) { anunciar('A biblioteca de planilha ainda não carregou. Tente de novo em um instante.'); return; }
  const lista = estado.visiveis.filter(v => !chave(statusEfetivo(v)).includes('perda'));
  if (!lista.length) { anunciar('Nada para exportar com este filtro.'); return; }

  const linhas = lista.map(v => {
    const status = statusEfetivo(v);
    return {
      'PLACA': valorDe(v, 'Placa'), 'CHASSI': valorDe(v, 'Chassi'), 'MODELO': valorDe(v, 'Modelo'),
      'FABRICANTE': valorDe(v, 'Fabricante', 'Marca'), 'KM ATUAL': '', 'COR': valorDe(v, 'Cor'),
      'RENAVAM': valorDe(v, 'Renavam'), 'ANO VEÍCULO': valorDe(v, 'Ano Veículo'),
      'ANO MODELO': valorDe(v, 'Ano Modelo'), 'TELEFONE': valorDe(v, 'Telefone'),
      'LOCATÁRIO': valorDe(v, 'Nome do motorista', 'Motorista'), 'CPF': valorDe(v, 'CPF'),
      'PROPRIETÁRIO': 'LM FROTAS', 'OPERAÇÃO': 'OPERAÇÃO', 'STATUS': status,
      'OBSERVAÇÃO DO STATUS': '', 'SUBSTATUS': SUBSTATUS[chave(status)] || '',
      'INÍCIO STATUS ATUAL': '', 'RASTREADOR': 'SMARTGPS'
    };
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(linhas), 'Frota');
  const hoje = new Date().toLocaleDateString('pt-BR').replace(/\//g, '.');
  XLSX.writeFile(wb, `(${hoje}) FROTA_STATUS DIÁRIA OCN BRASIL.xlsx`);
  anunciar(`Exportei ${linhas.length} veículos.`);
}

// ── painel do administrador ───────────────────────────────────────
async function abrirAdmin() {
  $('admin-msg').textContent = '';
  $('dlg-admin').showModal();
  await listarUsuarios();
  await carregarDiagnostico();
}

function recadoAdmin(texto, ok) {
  const msg = $('admin-msg');
  msg.textContent = texto;
  msg.className = ok ? 'ok' : 'err';
}

async function listarUsuarios() {
  const tbody = $('admin-tbody');
  tbody.replaceChildren(el('tr', {}, el('td', { colspan: '3', class: 'fraco centro', text: 'Carregando…' })));
  try {
    const r = await pedirLogado('/api/usuarios');
    tbody.replaceChildren(...r.usuarios.map(u => el('tr', {},
      el('td', { text: u.usuario }),
      el('td', {}, u.isAdmin ? el('span', { class: 'selo s-lilas', text: 'Admin' }) : document.createTextNode('Padrão')),
      el('td', { class: 'acoes-usuario' },
        el('button', { class: 'btn', type: 'button', text: 'Redefinir senha', onclick: () => redefinirSenha(u.usuario) }),
        el('button', { class: 'btn btn-perigo', type: 'button', text: 'Excluir', onclick: () => excluirUsuario(u.usuario) }))
    )));
  } catch (e) {
    tbody.replaceChildren(el('tr', {}, el('td', { colspan: '3', class: 'err', text: e.message })));
  }
}

async function adicionarUsuario(ev) {
  ev.preventDefault();
  const usuario = $('admin-usuario').value.trim();
  const senha = $('admin-senha').value;
  const admin = $('admin-perfil').value === 'true';
  if (!usuario || !senha) { recadoAdmin('Preencha usuário e senha.', false); return; }
  try {
    await pedirLogado('/api/usuarios', { method: 'POST', body: JSON.stringify({ usuario, senha, admin }) });
    $('admin-usuario').value = '';
    $('admin-senha').value = '';
    recadoAdmin('Usuário criado.', true);
    await listarUsuarios();
  } catch (e) {
    recadoAdmin(e.message, false);
  }
}

async function excluirUsuario(usuario) {
  if (!confirm(`Excluir o usuário "${usuario}"? Isso não volta atrás.`)) return;
  try {
    await pedirLogado(`/api/usuarios/${encodeURIComponent(usuario)}`, { method: 'DELETE' });
    recadoAdmin('Usuário excluído.', true);
    await listarUsuarios();
  } catch (e) {
    recadoAdmin(e.message, false);
  }
}

async function redefinirSenha(usuario) {
  const senha = prompt(`Nova senha para "${usuario}":`);
  if (!senha) return;
  try {
    await pedirLogado(`/api/usuarios/${encodeURIComponent(usuario)}/senha`, {
      method: 'POST', body: JSON.stringify({ senha })
    });
    recadoAdmin('Senha redefinida.', true);
  } catch (e) {
    recadoAdmin(e.message, false);
  }
}

async function carregarDiagnostico() {
  const alvo = $('admin-diagnostico');
  try {
    const d = await pedirLogado('/api/diagnostico');
    alvo.replaceChildren(
      el('div', { text: `Cabeçalho na linha ${d.linhaCabecalho ?? '—'} · ${d.colunasDaPlanilha?.length ?? 0} colunas na aba` }),
      el('div', { text: `Lido ${formatarQuando(d.lidoEm) || '—'}${d.servindoDaCopia ? ' · servindo da cópia' : ''}` }),
      d.colunasFaltando?.length
        ? el('div', { class: 'err', text: `Colunas não encontradas: ${d.colunasFaltando.join(', ')}` })
        : el('div', { class: 'ok', text: 'Todas as colunas esperadas foram encontradas.' }),
      /* A segunda aba é a que traz CPF e telefone. Quando ela cai, a tela não
         muda de cara — some com dois campos —, então o motivo precisa aparecer
         em algum lugar, e o lugar é aqui. */
      d.contatos?.linhaCabecalho
        ? el('div', {
            text: `Contatos (2ª aba): cabeçalho na linha ${d.contatos.linhaCabecalho}, ` +
                  `${d.contatos.linhasNaAba} linhas · ${d.contatos.comCpf} veículos com CPF ` +
                  `e ${d.contatos.comTelefone} com telefone`
          })
        : el('div', { class: 'err', text: 'Não consegui ler a aba de contatos — CPF e telefone ficam de fora.' })
    );
  } catch (e) {
    alvo.replaceChildren(el('div', { class: 'err', text: e.message }));
  }
}

// ── fiação ────────────────────────────────────────────────────────
function ligarFiltros() {
  $('busca').addEventListener('input', ev => {
    const valor = ev.target.value;
    clearTimeout(temporizadorBusca);
    /* 200ms depois da última tecla. Sem isso, cada tecla redesenhava as 170
       linhas e a busca travava — era o defeito nº 1 da lista. */
    temporizadorBusca = setTimeout(() => {
      estado.criterios.busca = valor;
      renderizar();
    }, 200);
  });

  for (const [id, criterio] of Object.entries(SELECTS)) {
    $(id).addEventListener('change', ev => {
      estado.criterios[criterio] = ev.target.value;
      guardarPrefs();
      renderizar();
    });
  }

  $('btn-limpar').addEventListener('click', limparFiltros);

  $('btn-mais-filtros').addEventListener('click', ev => {
    const painel = $('mais-filtros');
    painel.hidden = !painel.hidden;
    ev.currentTarget.setAttribute('aria-expanded', String(!painel.hidden));
  });

  for (const th of document.querySelectorAll('#tabela thead th[data-col]')) {
    th.querySelector('button').addEventListener('click', () => {
      const col = th.dataset.col;
      if (estado.ordem.coluna === col) {
        estado.ordem.direcao = estado.ordem.direcao === 'asc' ? 'desc' : 'asc';
      } else {
        estado.ordem = { coluna: col, direcao: 'asc' };
      }
      guardarPrefs();
      renderizar();
    });
  }

  for (const modo of ['compacto', 'confortavel']) {
    $('dens-' + modo).addEventListener('click', () => {
      estado.densidade = modo;
      guardarPrefs();
      aplicarDensidade();
      renderizar();
    });
  }
}

function aplicarDensidade() {
  for (const modo of ['compacto', 'confortavel']) {
    $('dens-' + modo).setAttribute('aria-pressed', String(estado.densidade === modo));
  }
  $('tabela').className = 'densidade-' + estado.densidade;
}

function ligarAtalhos() {
  document.addEventListener('keydown', ev => {
    const emCampo = /^(INPUT|SELECT|TEXTAREA)$/.test(ev.target.tagName);
    if (ev.key === '/' && !emCampo && !$('tela-app').hidden && !$('dlg-admin').open) {
      ev.preventDefault();
      $('busca').focus();
      $('busca').select();
      return;
    }
    if (ev.key === 'Escape' && !$('dlg-admin').open && !$('tela-app').hidden) {
      /* Esc é o "me tire daqui": fecha o detalhe e limpa a busca de uma vez. */
      let mexeu = false;
      if (estado.aberta) { estado.aberta = null; mexeu = true; }
      if (estado.criterios.busca) { estado.criterios.busca = ''; $('busca').value = ''; mexeu = true; }
      if (mexeu) { clearTimeout(temporizadorBusca); renderizar(); }
    }
  });
}

function iniciar() {
  lerPrefs();
  aplicarDensidade();
  ligarFiltros();
  ligarAtalhos();

  $('form-login').addEventListener('submit', entrar);
  $('btn-sair').addEventListener('click', sair);
  $('btn-atualizar').addEventListener('click', () => carregar());
  $('btn-admin').addEventListener('click', abrirAdmin);
  $('admin-form').addEventListener('submit', adicionarUsuario);
  $('admin-fechar').addEventListener('click', () => $('dlg-admin').close());
  $('btn-exportar').addEventListener('click', exportar);
  $('busca').value = estado.criterios.busca || '';

  let guardado = null;
  try { guardado = JSON.parse(localStorage.getItem(CHAVE_USUARIO) || 'null'); } catch { /* sem storage */ }
  if (guardado?.usuario) {
    /* Otimista: o cookie é httpOnly e não dá para conferir daqui. Se venceu, a
       primeira leitura devolve 401 e a tela volta sozinha para o login. */
    estado.usuario = guardado.usuario;
    estado.admin = !!guardado.admin;
    mostrarApp();
    carregar().then(iniciarRecarga);
  } else {
    mostrarLogin();
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
}
