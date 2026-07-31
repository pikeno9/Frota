// Usuários em SQLite. Aceita os hashes herdados do Apps Script (SHA-256 + sal
// fixo) para que ninguém precise recadastrar senha na migração, e troca cada um
// por scrypt no primeiro login bem-sucedido.

import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const SAL_LEGADO = 'lmfrotas_salt';

const hashLegado = senha => createHash('sha256').update(senha + SAL_LEGADO).digest('hex');

function hashScrypt(senha) {
  const sal = randomBytes(16);
  return `scrypt$${sal.toString('hex')}$${scryptSync(senha, sal, 64).toString('hex')}`;
}

function confereScrypt(senha, guardado) {
  const [, salHex, hashHex] = guardado.split('$');
  const esperado = Buffer.from(hashHex, 'hex');
  const obtido = scryptSync(senha, Buffer.from(salHex, 'hex'), esperado.length);
  return timingSafeEqual(esperado, obtido);
}

export function criarUsuarios({ caminhoBanco }) {
  // Sem isto, um caminho de volume mal montado falha com "unable to open database
  // file" sem citar qual caminho — o primeiro tropeço no dia do deploy.
  if (caminhoBanco !== ':memory:') mkdirSync(dirname(caminhoBanco), { recursive: true });
  const db = new DatabaseSync(caminhoBanco);
  db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      usuario    TEXT PRIMARY KEY,
      senha_hash TEXT NOT NULL,
      is_admin   INTEGER NOT NULL DEFAULT 0,
      ativo      INTEGER NOT NULL DEFAULT 1,
      criado_em  TEXT DEFAULT (datetime('now'))
    );
  `);

  const buscar = db.prepare('SELECT * FROM usuarios WHERE usuario = ?');
  const gravarHash = db.prepare('UPDATE usuarios SET senha_hash = ? WHERE usuario = ?');

  return {
    autenticar(usuario, senha) {
      const r = buscar.get(usuario);
      if (!r || !r.ativo) return { ok: false };

      let confere = false;
      if (String(r.senha_hash).startsWith('scrypt$')) {
        confere = confereScrypt(senha, r.senha_hash);
      } else {
        confere = r.senha_hash === hashLegado(senha);
        if (confere) gravarHash.run(hashScrypt(senha), usuario);  // migração silenciosa
      }
      return confere ? { ok: true, admin: !!r.is_admin } : { ok: false };
    },

    criar(usuario, senha, admin) {
      if (!usuario || !senha) return { ok: false, msg: 'Dados incompletos' };
      if (buscar.get(usuario)) return { ok: false, msg: 'Usuário já existe' };
      db.prepare('INSERT INTO usuarios (usuario, senha_hash, is_admin) VALUES (?, ?, ?)')
        .run(usuario, hashScrypt(senha), admin ? 1 : 0);
      return { ok: true };
    },

    remover(usuario) {
      db.prepare('DELETE FROM usuarios WHERE usuario = ?').run(usuario);
      return { ok: true };
    },

    redefinir(usuario, senha) {
      if (!buscar.get(usuario)) return { ok: false, msg: 'Usuário não encontrado' };
      gravarHash.run(hashScrypt(senha), usuario);
      return { ok: true };
    },

    listar() {
      return db.prepare('SELECT usuario, is_admin, ativo FROM usuarios ORDER BY usuario')
        .all().map(r => ({ usuario: r.usuario, isAdmin: !!r.is_admin, ativo: !!r.ativo }));
    },

    garantirAdminInicial(senha) {
      const { n } = db.prepare('SELECT COUNT(*) AS n FROM usuarios').get();
      if (n > 0 || !senha) return false;
      db.prepare('INSERT INTO usuarios (usuario, senha_hash, is_admin) VALUES (?, ?, 1)')
        .run('admin', hashScrypt(senha));
      return true;
    },

    importarLegado(linhas) {
      const ins = db.prepare(
        'INSERT OR IGNORE INTO usuarios (usuario, senha_hash, is_admin, ativo) VALUES (?, ?, ?, ?)'
      );
      // INSERT OR IGNORE silenciosamente pula duplicatas — devolver linhas.length aqui
      // mentiria pro dono da migração no momento de maior risco: ele leria "importei
      // tudo" mesmo quando metade foi ignorada por já existir.
      let importados = 0;
      for (const l of linhas) {
        const r = ins.run(l.usuario, l.senha_hash, l.isAdmin ? 1 : 0, l.ativo ? 1 : 0);
        importados += Number(r.changes);
      }
      return { ok: true, importados };
    },

    hashDe(usuario) { return buscar.get(usuario)?.senha_hash ?? null; },

    fechar() { db.close(); }
  };
}
