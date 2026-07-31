import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { interpretar } from './veiculos.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const OITO_HORAS = 8 * 60 * 60 * 1000;
const COOKIE = 'frota_sessao';
const MAX_TENTATIVAS = 5;
const JANELA_TENTATIVAS = 15 * 60 * 1000;

function lerCookie(req, nome) {
  const bruto = req.headers.cookie || '';
  for (const parte of bruto.split(';')) {
    const [k, ...v] = parte.trim().split('=');
    if (k === nome) return decodeURIComponent(v.join('='));
  }
  return null;
}

export function criarApp({ usuarios, sessao, cache, leitor, agora = Date.now, confiarProxy = false }) {
  const app = express();
  /* Atrás do proxy do Railway, req.ip só é o IP real do visitante com isto ligado.
     Fica desligado por padrão para os testes locais não dependerem de cabeçalho. */
  if (confiarProxy) app.set('trust proxy', 1);
  app.use(express.json());

  const tentativas = new Map();   // ip -> { contagem, desde }

  function barrado(ip) {
    const t = tentativas.get(ip);
    if (!t) return false;
    if (agora() - t.desde > JANELA_TENTATIVAS) { tentativas.delete(ip); return false; }
    return t.contagem >= MAX_TENTATIVAS;
  }

  function registrarErro(ip) {
    const t = tentativas.get(ip);
    if (!t || agora() - t.desde > JANELA_TENTATIVAS) tentativas.set(ip, { contagem: 1, desde: agora() });
    else t.contagem++;
  }

  function sessaoDe(req) {
    return sessao.ler(lerCookie(req, COOKIE), agora());
  }

  const exigeLogin = (req, res, prox) => {
    const s = sessaoDe(req);
    if (!s) return res.status(401).json({ erro: 'Faça login para continuar.' });
    req.sessao = s;
    prox();
  };

  const exigeAdmin = (req, res, prox) => {
    if (!req.sessao?.admin) return res.status(403).json({ erro: 'Acesso restrito ao administrador.' });
    prox();
  };

  // ── Sessão ───────────────────────────────────────────────
  app.post('/api/login', (req, res) => {
    const ip = req.ip;
    if (barrado(ip)) {
      return res.status(429).json({ erro: 'Muitas tentativas. Tente de novo em 15 minutos.' });
    }
    const { usuario, senha } = req.body || {};
    const r = usuarios.autenticar(usuario, senha);
    if (!r.ok) {
      registrarErro(ip);
      return res.status(401).json({ erro: 'Usuário ou senha incorretos.' });
    }
    tentativas.delete(ip);
    const valor = sessao.assinar({ u: usuario, admin: r.admin }, agora() + OITO_HORAS);
    res.cookie(COOKIE, valor, {
      httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: OITO_HORAS
    });
    res.json({ usuario, admin: r.admin });
  });

  app.post('/api/logout', (req, res) => {
    res.clearCookie(COOKIE);
    res.json({ ok: true });
  });

  // ── Veículos ─────────────────────────────────────────────
  async function atualizar() {
    const matriz = await leitor.ler();
    cache.oferecer(interpretar(matriz), agora());
  }

  app.get('/api/veiculos', exigeLogin, async (req, res) => {
    if (!cache.fresco(agora())) {
      try {
        await atualizar();
      } catch (e) {
        console.error('Falha ao ler a planilha:', e.message);
        if (!cache.ultima()) {
          return res.status(503).json({ erro: 'Não consegui ler a planilha e não tenho cópia anterior. ' + e.message });
        }
      }
    }
    const ultima = cache.ultima();
    if (!ultima) {
      const p = cache.problema();
      return res.status(503).json({ erro: 'Não consegui ler a planilha: ' + (p?.motivo ?? 'motivo desconhecido') });
    }
    res.json({ veiculos: ultima.veiculos, lidoEm: ultima.lidoEm, aviso: cache.problema() });
  });

  app.get('/api/diagnostico', exigeLogin, exigeAdmin, async (req, res) => {
    if (!cache.fresco(agora())) { try { await atualizar(); } catch { /* mostra o que tiver */ } }
    const u = cache.ultima();
    res.json({
      ...(u?.diagnostico ?? {}),
      lidoEm: u?.lidoEm ?? null,
      servindoDaCopia: !!cache.problema(),
      problema: cache.problema()
    });
  });

  // ── Usuários ─────────────────────────────────────────────
  app.get('/api/usuarios', exigeLogin, exigeAdmin, (req, res) => res.json({ usuarios: usuarios.listar() }));

  app.post('/api/usuarios', exigeLogin, exigeAdmin, (req, res) => {
    const { usuario, senha, admin } = req.body || {};
    const r = usuarios.criar(usuario, senha, !!admin);
    res.status(r.ok ? 200 : 400).json(r);
  });

  app.delete('/api/usuarios/:usuario', exigeLogin, exigeAdmin, (req, res) => {
    if (req.params.usuario === req.sessao.u) {
      return res.status(400).json({ ok: false, msg: 'Não é possível excluir sua própria conta' });
    }
    res.json(usuarios.remover(req.params.usuario));
  });

  app.post('/api/usuarios/:usuario/senha', exigeLogin, exigeAdmin, (req, res) => {
    const r = usuarios.redefinir(req.params.usuario, (req.body || {}).senha);
    res.status(r.ok ? 200 : 400).json(r);
  });

  app.get('/saude', (req, res) => res.json({ ok: true }));
  app.use(express.static(join(__dirname, '..', 'public')));
  return app;
}
