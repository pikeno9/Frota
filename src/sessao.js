// Sessão sem estado: os dados vão no próprio cookie, assinados com HMAC.
// Vantagem sobre o token guardado em ScriptProperties do Apps Script:
// reiniciar o servidor não desloga ninguém, e nada precisa ser guardado.

import { createHmac, timingSafeEqual } from 'node:crypto';

export function criarSessao(segredo) {
  const assinaturaDe = payload =>
    createHmac('sha256', segredo).update(payload).digest('base64url');

  return {
    assinar(dados, expiraEm) {
      const payload = Buffer.from(JSON.stringify({ ...dados, exp: expiraEm })).toString('base64url');
      return `${payload}.${assinaturaDe(payload)}`;
    },

    ler(valor, agora) {
      try {
        const partes = String(valor || '').split('.');
        if (partes.length !== 2) return null;
        const [payload, assinatura] = partes;
        if (!payload || !assinatura) return null;

        const esperada = Buffer.from(assinaturaDe(payload));
        const recebida = Buffer.from(assinatura);
        if (esperada.length !== recebida.length) return null;
        if (!timingSafeEqual(esperada, recebida)) return null;

        const dados = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
        if (typeof dados.exp !== 'number' || dados.exp <= agora) return null;

        return { u: dados.u, admin: !!dados.admin };
      } catch {
        return null;
      }
    }
  };
}
