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

export function montarPecas(env) {
  const planilhaId = exigir(env, 'PLANILHA_ID');
  const credenciaisJson = exigir(env, 'GOOGLE_SERVICE_ACCOUNT_JSON');
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
    confiarProxy: env.NODE_ENV === 'production'
  };
}

// Só sobe a porta quando este arquivo é o executado. Importado pelo teste, não sobe nada.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const porta = process.env.PORT || 3000;
  criarApp(montarPecas(process.env)).listen(porta, () => console.log(`Servidor ouvindo em :${porta}`));
}
