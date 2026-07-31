import { pathToFileURL } from 'node:url';
import { criarApp } from './src/app.js';
import { criarUsuarios } from './src/usuarios.js';
import { criarSessao } from './src/sessao.js';
import { criarCache } from './src/cache.js';
import { criarLeitor } from './src/planilha.js';

function exigir(env, nome) {
  const v = env[nome];
  if (!v) throw new Error(`Falta a variável de ambiente ${nome}.`);
  return v;
}

/* Sem isto, um GOOGLE_SERVICE_ACCOUNT_JSON colado errado só falha na primeira
   leitura da planilha — depois do deploy, silenciosamente, na hora do Fix 1.
   Validar aqui faz o boot falhar alto e cedo, com o nome da variável certa. */
function validarCredenciaisGoogle(json) {
  let cred;
  try {
    cred = JSON.parse(json);
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON não é um JSON válido.');
  }
  if (!cred || !cred.client_email) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON não tem client_email.');
  }
  return json;
}

export function montarPecas(env) {
  const planilhaId = exigir(env, 'PLANILHA_ID');
  const credenciaisJson = validarCredenciaisGoogle(exigir(env, 'GOOGLE_SERVICE_ACCOUNT_JSON'));
  const segredo = exigir(env, 'SESSION_SECRET');

  const usuarios = criarUsuarios({ caminhoBanco: env.DB_PATH || '/data/frota.db' });
  if (usuarios.garantirAdminInicial(env.ADMIN_SENHA_INICIAL)) {
    console.log('Usuário admin criado a partir de ADMIN_SENHA_INICIAL.');
  }

  return {
    usuarios,
    sessao: criarSessao(segredo),
    cache: criarCache({
      arquivo: env.COPIA_PATH || '/data/ultima-leitura.json',
      minutos: Number(env.CACHE_MINUTOS || 5)
    }),
    leitor: criarLeitor({ planilhaId, aba: env.PLANILHA_ABA || 'import_data', credenciaisJson }),
    /* No Railway o servidor fica atrás de um proxy. Sem isto, req.ip devolve o IP do
       proxy para todo mundo e o limite de tentativas de login vira global — uma pessoa
       errando a senha trancaria a equipe inteira. */
    confiarProxy: env.NODE_ENV === 'production',
    // Cookie "secure" exige HTTPS. Em produção o Railway serve por HTTPS; localmente
    // exigir isso quebraria o cookie de sessão em http://localhost.
    cookieSeguro: env.NODE_ENV === 'production'
  };
}

// Só sobe a porta quando este arquivo é o executado. Importado pelo teste, não sobe nada.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const porta = process.env.PORT || 3000;
  criarApp(montarPecas(process.env)).listen(porta, () => console.log(`Servidor ouvindo em :${porta}`));
}
