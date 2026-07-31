// Traz a aba da planilha como matriz crua. Não interpreta nada:
// quem sabe o que é uma placa é o veiculos.js.

import { JWT } from 'google-auth-library';

const ESCOPO = ['https://www.googleapis.com/auth/spreadsheets.readonly'];

async function buscarNoGoogle(url, credenciaisJson) {
  const cred = JSON.parse(credenciaisJson);
  const jwt = new JWT({ email: cred.client_email, key: cred.private_key, scopes: ESCOPO });
  const { token } = await jwt.getAccessToken();

  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) {
    throw new Error(`Google respondeu ${r.status} ao ler a planilha: ${await r.text()}`);
  }
  return r.json();
}

export function criarLeitor({ planilhaId, aba, credenciaisJson, buscar }) {
  const chamar = buscar || (url => buscarNoGoogle(url, credenciaisJson));

  return {
    async ler() {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${planilhaId}` +
                  `/values/${encodeURIComponent(aba)}?valueRenderOption=UNFORMATTED_VALUE` +
                  `&dateTimeRenderOption=FORMATTED_STRING`;
      const dados = await chamar(url);
      return dados?.values ?? [];
    }
  };
}
