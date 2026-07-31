// Roda uma vez, na migração: copia a aba `usuarios` da planilha para o SQLite.
// Os hashes vão como estão — quem sabe a senha continua entrando com ela.
//
//   node --experimental-sqlite scripts/importar-usuarios.js

import { criarUsuarios } from '../src/usuarios.js';
import { criarLeitor } from '../src/planilha.js';

const leitor = criarLeitor({
  planilhaId: process.env.PLANILHA_ID,
  aba: 'usuarios',
  credenciaisJson: process.env.GOOGLE_SERVICE_ACCOUNT_JSON
});

const matriz = await leitor.ler();
if (matriz.length < 2) {
  console.error('A aba "usuarios" veio vazia. Nada a importar.');
  process.exit(1);
}

// Cabeçalho da aba criada pelo Apps Script: usuario | senha_hash | isAdmin | ativo
const linhas = matriz.slice(1)
  .filter(l => l[0])
  .map(l => ({
    usuario: String(l[0]).trim(),
    senha_hash: String(l[1]).trim(),
    isAdmin: l[2] === true || String(l[2]).toUpperCase() === 'TRUE',
    ativo: l[3] === true || String(l[3]).toUpperCase() === 'TRUE'
  }));

const usuarios = criarUsuarios({ caminhoBanco: process.env.DB_PATH || '/data/frota.db' });
const r = usuarios.importarLegado(linhas);
console.log(`Importados ${r.importados} usuários:`, linhas.map(l => l.usuario).join(', '));
usuarios.fechar();
