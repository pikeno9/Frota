// Guarda a última leitura BOA da planilha e recusa as ruins.
//
// Em 30/07/2026 uma leitura ruim sobrescreveu o data.json bom e o site ficou
// em branco. Aqui a ordem se inverte: a leitura ruim é registrada como problema
// e a boa anterior continua sendo servida.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

function avaliar(leitura) {
  /* Um portão só para "achei um cabeçalho utilizável". Separar em dois — "achei o
     cabeçalho" e "tem coluna Placa" — seria redundante: veiculos.js só aceita como
     cabeçalho uma linha que contenha "Placa", então o segundo nunca dispararia. Uma
     condição, e uma mensagem que diz o que foi procurado e onde. */
  if (!leitura || leitura.linhaCabecalho == null || !leitura.colunasAchadas?.includes('Placa')) {
    return 'não achei nenhuma linha de cabeçalho com a coluna "Placa" nas primeiras 40 linhas da aba';
  }
  if (!leitura.veiculos?.length) {
    return 'a planilha voltou sem nenhum veículo';
  }
  return null;
}

export function criarCache({ arquivo, minutos = 5 }) {
  let ultimaBoa = null;      // { veiculos, diagnostico, lidoEm }
  let problemaAtual = null;  // { motivo, desde }

  try {
    const salvo = JSON.parse(readFileSync(arquivo, 'utf8'));
    if (salvo?.veiculos?.length) ultimaBoa = salvo;
  } catch {
    // Sem arquivo, ilegível ou corrompido: começamos sem cópia. Não é erro fatal.
  }

  function persistir() {
    try {
      mkdirSync(dirname(arquivo), { recursive: true });
      writeFileSync(arquivo, JSON.stringify(ultimaBoa));
    } catch (e) {
      console.error('Não consegui gravar a cópia de segurança:', e.message);
    }
  }

  return {
    oferecer(leitura, agora) {
      const motivo = avaliar(leitura);
      if (motivo) {
        if (!problemaAtual) problemaAtual = { motivo, desde: agora };
        else problemaAtual = { motivo, desde: problemaAtual.desde };
        return { aceita: false, motivo };
      }
      ultimaBoa = {
        veiculos: leitura.veiculos,
        diagnostico: {
          linhaCabecalho: leitura.linhaCabecalho,
          colunasDaPlanilha: leitura.colunasDaPlanilha,
          colunasAchadas: leitura.colunasAchadas,
          colunasFaltando: leitura.colunasFaltando
        },
        lidoEm: agora
      };
      problemaAtual = null;
      persistir();
      return { aceita: true, motivo: null };
    },
    fresco(agora) {
      return !!ultimaBoa && (agora - ultimaBoa.lidoEm) < minutos * 60_000;
    },
    ultima() { return ultimaBoa; },
    problema() { return problemaAtual; }
  };
}
