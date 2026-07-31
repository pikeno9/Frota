import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpretarContatos, enriquecerComContatos, chaveNome } from '../src/contatos.js';

/* A aba import_dados de verdade: cabeçalho na linha 8, sete linhas de sujeira em
   cima, B = Nome do motorista, H = Telefone, J = CPF do motorista, Q = Placa do
   veículo. As colunas do meio existem e não interessam — ficam vazias aqui. */
const B = 1, H = 7, J = 9, Q = 16;

function linha(campos = {}) {
  const l = Array.from({ length: 20 }, () => '');
  for (const [i, v] of Object.entries(campos)) l[i] = v;
  return l;
}

const CABECALHO = linha({
  [B]: 'Nome do motorista', [H]: 'Telefone', [J]: 'CPF do motorista', [Q]: 'Placa do veículo'
});

const SUJEIRA = [
  ['Relatório de importação — não mexer'],
  [],
  ['Gerado automaticamente'],
  [],
  [],
  [],
  []
];

function abaDeContatos(...linhas) {
  return [...SUJEIRA, CABECALHO, ...linhas];
}

const ANA = linha({ [B]: 'Ana Beatriz Moraes', [H]: '11987654321', [J]: '12345678901', [Q]: 'BQK4E12' });
/* Carlos aparece três vezes — é o caso dos 27 nomes repetidos por reagendamento. */
const CARLOS_1 = linha({ [B]: 'Carlos Eduardo Lima', [H]: '11911111111', [J]: '22222222222', [Q]: 'AAA1A11' });
const CARLOS_2 = linha({ [B]: 'Carlos Eduardo Lima', [H]: '11922222222', [J]: '22222222222', [Q]: 'CUM0J31' });
const CARLOS_3 = linha({ [B]: 'Carlos Eduardo Lima', [H]: '11933333333', [J]: '22222222222', [Q]: 'BBB2B22' });
/* Joyce repetida, mas nenhuma das placas é a do carro que ela dirige hoje. */
const JOYCE_1 = linha({ [B]: 'Joyce Ribeiro', [H]: '11944444444', [J]: '33333333333', [Q]: 'XXX9X99' });
const JOYCE_2 = linha({ [B]: 'Joyce Ribeiro', [H]: '11955555555', [J]: '33333333333', [Q]: 'YYY8Y88' });
/* Metade da aba não tem telefone: 144 de 278 na medição de 31/07. */
const MARCELO = linha({ [B]: 'Marcelo Antunes', [H]: '', [J]: '44444444444', [Q]: 'EGX9H53' });
/* O motorista anterior de um carro que foi realugado. */
const ANTIGO = linha({ [B]: 'Rogério Antigo', [H]: '11966666666', [J]: '55555555555', [Q]: 'REA1L11' });
/* Acento, caixa e espaço sobrando — a planilha escreve como quer. */
const JOSE = linha({ [B]: '  JOSÉ  DA SILVA JR. ', [H]: '11977777777', [J]: '66666666666', [Q]: 'JSJ1J11' });

const ABA = abaDeContatos(ANA, CARLOS_1, CARLOS_2, CARLOS_3, JOYCE_1, JOYCE_2, MARCELO, ANTIGO, JOSE);

const carro = (placa, motorista) => ({ Placa: placa, 'Nome do motorista': motorista, Modelo: 'Polo' });

// ══════════════════════ o cabeçalho ══════════════════════

test('acha o cabeçalho sozinho, sem a linha 8 estar escrita no código', () => {
  const c = interpretarContatos(ABA);
  assert.equal(c.linhaCabecalho, 8, 'o cabeçalho da import_dados está na linha 8');
  assert.equal(c.utilizavel, true);
  assert.deepEqual(c.colunasFaltando, []);
});

test('o cabeçalho continua sendo achado se a planilha ganhar linhas em cima', () => {
  const c = interpretarContatos([[], ['aviso novo'], ...ABA]);
  assert.equal(c.linhaCabecalho, 10);
  assert.equal(c.utilizavel, true);
});

test('aba sem cabeçalho reconhecível não é utilizável e não lança', () => {
  for (const entrada of [[], [['lixo', 'nenhum']], null, undefined, 'nem matriz']) {
    const c = interpretarContatos(entrada);
    assert.equal(c.utilizavel, false);
    assert.equal(c.linhas, 0);
    assert.equal(c.buscar('Ana Beatriz Moraes', 'BQK4E12'), null);
  }
});

// ══════════════════════ o casamento por nome ══════════════════════

test('nome exato: traz CPF e telefone do motorista', () => {
  const achado = interpretarContatos(ABA).buscar('Ana Beatriz Moraes', 'BQK4E12');
  assert.equal(achado.cpf, '123.456.789-01');
  assert.equal(achado.telefone, '(11) 98765-4321');
});

test('nome repetido: a placa desempata', () => {
  const c = interpretarContatos(ABA);
  assert.equal(c.buscar('Carlos Eduardo Lima', 'CUM0J31').telefone, '(11) 92222-2222');
  assert.equal(c.buscar('Carlos Eduardo Lima', 'BBB2B22').telefone, '(11) 93333-3333');
});

test('nome repetido e nenhuma placa bate: fica com a última linha', () => {
  const c = interpretarContatos(ABA);
  assert.equal(c.buscar('Joyce Ribeiro', 'ZZZ0Z00').telefone, '(11) 95555-5555');
  assert.equal(c.buscar('Joyce Ribeiro', '').telefone, '(11) 95555-5555');
});

test('a placa é só desempate: nome que não existe na aba não casa por placa', () => {
  /* O carro REA1L11 foi realugado. A linha daquela placa é do motorista velho e
     não pode vazar para o novo — é por isso que o nome é a chave. */
  const c = interpretarContatos(ABA);
  assert.equal(c.buscar('Motorista Novo da Silva', 'REA1L11'), null);
});

test('motorista fora da aba não inventa contato', () => {
  assert.equal(interpretarContatos(ABA).buscar('Quem Nunca Apareceu', 'AAA0A00'), null);
  assert.equal(interpretarContatos(ABA).buscar('', 'BQK4E12'), null);
});

test('acento, caixa e espaço sobrando não separam a mesma pessoa', () => {
  const c = interpretarContatos(ABA);
  assert.equal(c.buscar('Jose da Silva Jr', 'JSJ1J11').cpf, '666.666.666-66');
  assert.equal(c.buscar('josé   da  silva jr.', 'JSJ1J11').cpf, '666.666.666-66');
  assert.equal(chaveNome('  JOSÉ  DA SILVA JR. '), chaveNome('jose da silva jr'));
});

test('placa casa com ou sem hífen e caixa', () => {
  const c = interpretarContatos(ABA);
  assert.equal(c.buscar('Carlos Eduardo Lima', 'cum-0j31').telefone, '(11) 92222-2222');
});

// ══════════════════════ CPF e telefone crus ══════════════════════

test('número vindo da planilha vira texto, sem notação científica', () => {
  const aba = abaDeContatos(linha({ [B]: 'Numérico Silva', [H]: 11987654321, [J]: 98765432100, [Q]: 'NUM1N11' }));
  const achado = interpretarContatos(aba).buscar('Numérico Silva', 'NUM1N11');
  assert.equal(achado.telefone, '(11) 98765-4321');
  assert.equal(achado.cpf, '987.654.321-00');
});

test('o que não tem cara de CPF nem de telefone passa cru — formatar não é inventar', () => {
  const aba = abaDeContatos(linha({ [B]: 'Torto Souza', [H]: '+55 11 3333-4444 (recado)', [J]: 'não informado', [Q]: 'TOR1T11' }));
  const achado = interpretarContatos(aba).buscar('Torto Souza', 'TOR1T11');
  assert.equal(achado.telefone, '+55 11 3333-4444 (recado)');
  assert.equal(achado.cpf, 'não informado');
});

// ══════════════════════ enriquecer a lista ══════════════════════

test('enriquecer põe CPF e Telefone em todo veículo, mesmo sem contato', () => {
  const c = interpretarContatos(ABA);
  const frota = [carro('BQK4E12', 'Ana Beatriz Moraes'), carro('AAA0A00', 'Quem Nunca Apareceu')];
  const [comContato, semContato] = enriquecerComContatos(frota, c);

  assert.equal(comContato.CPF, '123.456.789-01');
  assert.equal(comContato.Telefone, '(11) 98765-4321');
  /* Os campos existem e vêm vazios: a tela desenha traço. Sumir com o campo em
     metade das linhas é que pareceria defeito. */
  assert.ok(Object.hasOwn(semContato, 'CPF'), 'a coluna CPF precisa existir mesmo sem contato');
  assert.ok(Object.hasOwn(semContato, 'Telefone'), 'a coluna Telefone precisa existir mesmo sem contato');
  assert.equal(semContato.CPF, '');
  assert.equal(semContato.Telefone, '');
});

test('motorista com CPF e sem telefone: CPF vem, telefone fica vazio', () => {
  const [v] = enriquecerComContatos([carro('EGX9H53', 'Marcelo Antunes')], interpretarContatos(ABA));
  assert.equal(v.CPF, '444.444.444-44');
  assert.equal(v.Telefone, '', 'metade da frota não tem telefone na planilha — e isso não é defeito');
});

test('enriquecer não muta a lista nem os veículos que recebeu', () => {
  const original = carro('BQK4E12', 'Ana Beatriz Moraes');
  const frota = [original];
  const saida = enriquecerComContatos(frota, interpretarContatos(ABA));
  assert.equal(frota.length, 1);
  assert.notEqual(saida[0], original, 'o veículo enriquecido é uma cópia');
  assert.ok(!Object.hasOwn(original, 'CPF'), 'o veículo de entrada continua como veio da planilha');
});

test('REGRA CENTRAL: aba de contatos ilegível não derruba a lista de veículos', () => {
  const frota = [carro('BQK4E12', 'Ana Beatriz Moraes'), carro('CUM0J31', 'Carlos Eduardo Lima')];
  for (const ruim of [[], null, undefined, [['lixo']]]) {
    const saida = enriquecerComContatos(frota, interpretarContatos(ruim));
    assert.equal(saida.length, 2, 'os veículos continuam todos lá');
    assert.equal(saida[0].Placa, 'BQK4E12');
    assert.ok(!Object.hasOwn(saida[0], 'CPF'), 'sem aba lida, a tela não finge que tem a coluna');
  }
  assert.deepEqual(enriquecerComContatos(frota, null).length, 2);
  assert.deepEqual(enriquecerComContatos(undefined, interpretarContatos(ABA)), []);
});

test('CPF que a aba principal já trouxesse não é apagado pelo enriquecimento', () => {
  const veiculo = { ...carro('AAA0A00', 'Quem Nunca Apareceu'), CPF: '000.000.000-00' };
  const [v] = enriquecerComContatos([veiculo], interpretarContatos(ABA));
  assert.equal(v.CPF, '000.000.000-00');
});

test('a contagem serve o diagnóstico do administrador', () => {
  const c = interpretarContatos(ABA);
  assert.equal(c.linhas, 9);
  assert.equal(c.comCpf, 9);
  assert.equal(c.comTelefone, 8, 'o Marcelo não tem telefone');
});

test('linha sem nome de motorista é ignorada', () => {
  const c = interpretarContatos(abaDeContatos(linha({ [H]: '11999999999', [J]: '11111111111' }), ANA));
  assert.equal(c.linhas, 1);
  assert.equal(c.buscar('Ana Beatriz Moraes', 'BQK4E12').cpf, '123.456.789-01');
});
