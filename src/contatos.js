// CPF e telefone do motorista, que moram em OUTRA aba.
//
// A aba "Carros Ativos" perdeu essas duas colunas em 2026; elas continuam vivas
// na aba `import_dados`, uma linha por locação (cabeçalho na linha 8 em 31/07:
// B = Nome do motorista, H = Telefone, J = CPF do motorista, Q = Placa do veículo).
// Como em veiculos.js, o cabeçalho é PROCURADO e as colunas são achadas pelo
// nome — nenhuma linha nem letra de coluna fica escrita no código.
//
// A chave do casamento é o NOME do motorista, não a placa: um carro realugado
// tem, naquela aba, uma linha antiga com o motorista anterior. Casar por placa
// colaria o telefone de quem devolveu o carro no nome de quem está com ele hoje.
// Quando o mesmo nome aparece em várias linhas (reagendamento — 27 casos em
// 31/07), a placa desempata; sem placa que bata, vale a última linha, que é a
// mais recente.
//
// Cobertura medida em 31/07: CPF em 278 de 278 linhas, telefone em 144. Metade
// da frota vai mostrar telefone vazio — isso é a planilha, não defeito, e a tela
// desenha traço. Nunca inventar.

import { normalizar } from './veiculos.js';

const LINHAS_BUSCA = 40;

const ALIASES = {
  'Nome do motorista': ['nome do motorista', 'motorista', 'nome do locatario', 'locatario'],
  'Telefone':          ['telefone', 'telefone do motorista', 'celular', 'fone'],
  'CPF':               ['cpf do motorista', 'cpf'],
  'Placa':             ['placa do veiculo', 'placa']
};

const CANONICOS = Object.keys(ALIASES);

/* Nome de gente escrito por três pessoas diferentes: "JOSÉ DA SILVA JR.",
   "Jose da Silva Jr" e "José  da Silva  Jr" são a mesma pessoa. Tira acento,
   troca pontuação por espaço, colapsa espaço e baixa a caixa. O que NÃO faz:
   aproximar nomes parecidos. Casamento aproximado erraria de pessoa, e um
   telefone trocado é pior que um traço. */
export function chaveNome(v) {
  return String(v ?? '')
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .toLowerCase();
}

/* Placa é código: "cum-0j31" e "CUM0J31" são a mesma. */
export function chavePlaca(v) {
  return String(v ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

function texto(v) {
  if (v == null) return '';
  /* UNFORMATTED_VALUE devolve número quando a célula é número: 11987654321 e
     não "11987654321". String() dá conta sem notação científica nessa faixa. */
  return String(v).trim();
}

const digitos = s => s.replace(/\D/g, '');

/* Formatar não é inventar: sai o mesmo dígito que entrou, só com a máscara que
   a equipe está acostumada a ler. O que não tem o tamanho certo passa cru — é
   melhor mostrar "não informado" do que fingir que aquilo é um CPF. */
export function formatarCpf(bruto) {
  const s = texto(bruto);
  const d = digitos(s);
  if (d.length !== 11) return s;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function formatarTelefone(bruto) {
  const s = texto(bruto);
  const d = digitos(s);
  if (d.length !== 10 && d.length !== 11) return s;
  const ddd = d.slice(0, 2);
  const resto = d.slice(2);
  return `(${ddd}) ${resto.slice(0, resto.length - 4)}-${resto.slice(-4)}`;
}

function acharCabecalho(matriz) {
  const limite = Math.min(LINHAS_BUSCA, matriz.length);
  let melhor = -1, maiorPonto = 0;
  for (let i = 0; i < limite; i++) {
    const celulas = (matriz[i] || []).map(normalizar);
    /* Sem coluna de motorista não há casamento possível: essa linha não serve
       de cabeçalho por mais colunas que tenha. */
    if (!ALIASES['Nome do motorista'].some(a => celulas.includes(a))) continue;
    let pontos = 0;
    for (const canon of CANONICOS) {
      if (ALIASES[canon].some(a => celulas.includes(a))) pontos++;
    }
    if (pontos > maiorPonto) { maiorPonto = pontos; melhor = i; }
  }
  // Nome + pelo menos um dos dois dados que a tela veio buscar.
  return maiorPonto >= 2 ? melhor : -1;
}

const VAZIO = {
  utilizavel: false,
  linhaCabecalho: null,
  colunasAchadas: [],
  colunasFaltando: CANONICOS,
  linhas: 0,
  comCpf: 0,
  comTelefone: 0,
  porNome: new Map(),
  buscar: () => null
};

export function interpretarContatos(matriz) {
  if (!Array.isArray(matriz) || matriz.length === 0) return VAZIO;

  const idx = acharCabecalho(matriz);
  if (idx === -1) return VAZIO;

  const norm = (matriz[idx] || []).map(normalizar);
  const mapa = {};
  for (const canon of CANONICOS) {
    for (const a of ALIASES[canon]) {
      const p = norm.indexOf(a);
      if (p !== -1) { mapa[canon] = p; break; }
    }
  }
  if (mapa['CPF'] === undefined && mapa['Telefone'] === undefined) return VAZIO;

  const col = (row, canon) => (mapa[canon] === undefined ? '' : texto(row[mapa[canon]]));

  const porNome = new Map();
  let linhas = 0, comCpf = 0, comTelefone = 0;

  for (const bruta of matriz.slice(idx + 1)) {
    const row = bruta || [];
    const nome = col(row, 'Nome do motorista');
    if (!nome) continue;
    const registro = {
      nome,
      cpf: formatarCpf(col(row, 'CPF')),
      telefone: formatarTelefone(col(row, 'Telefone')),
      placa: col(row, 'Placa')
    };
    linhas++;
    if (registro.cpf) comCpf++;
    if (registro.telefone) comTelefone++;
    const k = chaveNome(nome);
    if (!porNome.has(k)) porNome.set(k, []);
    porNome.get(k).push(registro);   // na ordem da planilha: a última é a mais recente
  }

  return {
    utilizavel: porNome.size > 0,
    linhaCabecalho: idx + 1,
    colunasAchadas: CANONICOS.filter(c => mapa[c] !== undefined),
    colunasFaltando: CANONICOS.filter(c => mapa[c] === undefined),
    linhas, comCpf, comTelefone, porNome,
    buscar: (nome, placa) => escolher(porNome.get(chaveNome(nome)), placa)
  };
}

function escolher(lista, placa) {
  if (!lista || lista.length === 0) return null;
  if (lista.length === 1) return lista[0];
  const alvo = chavePlaca(placa);
  if (alvo) {
    for (let i = lista.length - 1; i >= 0; i--) {
      if (chavePlaca(lista[i].placa) === alvo) return lista[i];
    }
  }
  return lista[lista.length - 1];
}

function valorDe(veiculo, ...apelidos) {
  if (!veiculo || typeof veiculo !== 'object') return '';
  const alvos = apelidos.map(normalizar);
  for (const k of Object.keys(veiculo)) {
    if (!alvos.includes(normalizar(k))) continue;
    const v = texto(veiculo[k]);
    if (v) return v;
  }
  return '';
}

const NOME = ['Nome do motorista', 'Motorista', 'Condutor', 'Locatário'];

/* Devolve uma lista nova de veículos novos — não mexe no que recebeu.
   Sem aba de contatos utilizável, devolve a lista como veio: sem as chaves CPF
   e Telefone, a tela nem desenha os campos, em vez de mostrar dois traços
   permanentes que ninguém sabe explicar. Com a aba lida, TODO veículo ganha as
   duas chaves, mesmo vazias — aí o traço quer dizer "a planilha não tem". */
export function enriquecerComContatos(veiculos, contatos) {
  const lista = Array.isArray(veiculos) ? veiculos : [];
  if (!contatos?.utilizavel) return lista;

  return lista.map(v => {
    const achado = contatos.buscar(valorDe(v, ...NOME), valorDe(v, 'Placa'));
    const enriquecido = { CPF: '', Telefone: '', ...v };
    // Se um dia a aba principal voltar a ter as colunas, o que ela traz manda.
    if (achado?.cpf && !enriquecido.CPF) enriquecido.CPF = achado.cpf;
    if (achado?.telefone && !enriquecido.Telefone) enriquecido.Telefone = achado.telefone;
    return enriquecido;
  });
}
