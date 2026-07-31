import { criarApp } from './src/app.js';

const porta = process.env.PORT || 3000;
criarApp({}).listen(porta, () => console.log(`Servidor ouvindo em :${porta}`));
