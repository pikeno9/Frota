// Interpreta a aba crua da planilha. Função pura: entra matriz, sai objeto.
//
// O cabeçalho é PROCURADO, não assumido. Em 30/07/2026 o site quebrou porque
// o Apps Script lia a linha 11 fixa; a planilha foi reorganizada e a linha 11
// virou dado. Procurar custa uma varredura de 40 linhas e evita esse retorno.

const LINHAS_BUSCA = 40;

const ALIASES = {
  'Placa':             ['placa'],
  'Chassi':            ['chassi'],
  'Renavam':           ['renavam'],
  'Fabricante':        ['fabricante', 'marca'],
  'Modelo':            ['modelo'],
  'Cor':               ['cor'],
  'Ano Veículo':       ['ano veiculo', 'ano do veiculo', 'ano'],
  'Ano Modelo':        ['ano modelo', 'ano do modelo'],
  'Nome do motorista': ['nome do motorista', 'motorista', 'condutor', 'locatario',
                        'nome do locatario', 'cliente'],
  'CPF':               ['cpf'],
  'Telefone':          ['telefone', 'celular', 'fone', 'contato'],
  'Status':            ['status', 'situacao']
};

export function normalizar(v) {
  return String(v == null ? '' : v)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[?:.]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function acharCabecalho(matriz) {
  const limite = Math.min(LINHAS_BUSCA, matriz.length);
  let melhor = -1, maiorPonto = 0;
  for (let i = 0; i < limite; i++) {
    const celulas = (matriz[i] || []).map(normalizar);
    if (!celulas.includes('placa')) continue;
    let pontos = 0;
    for (const canon of Object.keys(ALIASES)) {
      if (ALIASES[canon].some(a => celulas.includes(a))) pontos++;
    }
    if (pontos > maiorPonto) { maiorPonto = pontos; melhor = i; }
  }
  return maiorPonto >= 3 ? melhor : -1;
}

export function interpretar(matriz) {
  const vazio = {
    veiculos: [], linhaCabecalho: null, colunasDaPlanilha: [],
    colunasAchadas: [], colunasFaltando: Object.keys(ALIASES)
  };
  if (!Array.isArray(matriz) || matriz.length === 0) return vazio;

  const idx = acharCabecalho(matriz);
  if (idx === -1) return vazio;

  const headers = matriz[idx];
  const norm = headers.map(normalizar);

  const mapa = {};
  for (const canon of Object.keys(ALIASES)) {
    for (const a of ALIASES[canon]) {
      const p = norm.indexOf(a);
      if (p !== -1) { mapa[canon] = p; break; }
    }
  }
  /* Não precisa checar mapa['Placa']: acharCabecalho só devolve uma linha que contenha
     a célula "placa", então o mapeamento sempre existe aqui. Quem recusa uma leitura
     sem Placa é o cache.js, que é o dono dessa decisão. */

  const colPlaca = mapa['Placa'];
  const veiculos = matriz.slice(idx + 1)
    .filter(row => String((row || [])[colPlaca] ?? '').trim() !== '')
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => {
        const nome = String(h ?? '').trim();
        if (nome) obj[nome] = row[i];
      });
      for (const canon of Object.keys(mapa)) {
        if (obj[canon] === undefined || obj[canon] === '') obj[canon] = row[mapa[canon]];
      }
      return obj;
    });

  return {
    veiculos,
    linhaCabecalho: idx + 1,
    colunasDaPlanilha: headers.map(h => String(h ?? '').trim()),
    colunasAchadas: Object.keys(mapa),
    colunasFaltando: Object.keys(ALIASES).filter(c => mapa[c] === undefined)
  };
}
