import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpretar } from '../src/veiculos.js';

const HEADER_ANTIGO = ['', '#', 'Placa', 'Data de recebimento', 'Fabricante', 'Modelo', 'Cor',
  'Ano Veículo', 'Ano Modelo', 'Chassi', 'Renavam', 'Cidade Entrega', 'UF Entrega', 'Safra', 'Frota',
  'Nome do motorista', 'Status', 'Telefone', 'CPF', 'Dia do rodízio'];

const HEADER_NOVO = ['Final da placa', 'Ano', 'Frota', '', 'Placa', 'Data de recebimento', 'Fabricante',
  'Modelo', 'Cor', 'Chassi', 'Renavam', 'Cidade Entrega', 'UF Entrega', 'Safra', 'Nome do motorista',
  'Status', 'Substatus', 'Rastreador', 'Telefone', 'CPF', 'Dia do rodízio'];

const HEADER_RENOMEADO = ['PLACA', 'MARCA', 'MODELO', 'COR', 'CHASSI', 'MOTORISTA', 'SITUAÇÃO', 'CELULAR'];

function linha(header, i) {
  return header.map(h => {
    const n = String(h).toLowerCase();
    if (n.startsWith('placa')) return 'ABC' + (1000 + i);
    if (n === 'modelo') return 'Polo 1.0 Track';
    if (n === 'fabricante' || n === 'marca') return 'VOLKSWAGEN';
    if (n === 'status' || n === 'situação') return 'Alugado';
    if (n.includes('motorista')) return 'Motorista ' + i;
    if (n === 'cor') return 'BRANCO';
    return '';
  });
}

function planilha(header, linhasAcima, qtd) {
  const m = [];
  for (let i = 0; i < linhasAcima; i++) m.push(new Array(header.length).fill(i === 0 ? 'RELATÓRIO' : ''));
  m.push(header.slice());
  for (let i = 0; i < qtd; i++) m.push(linha(header, i));
  return m;
}

test('layout antigo: acha o cabeçalho na linha 11', () => {
  const r = interpretar(planilha(HEADER_ANTIGO, 10, 5));
  assert.equal(r.linhaCabecalho, 11);
  assert.equal(r.veiculos.length, 5);
  assert.equal(r.veiculos[0]['Placa'], 'ABC1000');
  assert.deepEqual(r.colunasFaltando, []);
});

test('layout novo: cabeçalho subiu para a linha 10', () => {
  const r = interpretar(planilha(HEADER_NOVO, 9, 989));
  assert.equal(r.linhaCabecalho, 10);
  assert.equal(r.veiculos.length, 989);
  assert.equal(r.veiculos[0]['Fabricante'], 'VOLKSWAGEN');
  assert.equal(r.veiculos[0]['Status'], 'Alugado');
  assert.equal(r.veiculos[0]['Nome do motorista'], 'Motorista 0');
});

test('cabeçalho na linha 1', () => {
  assert.equal(interpretar(planilha(HEADER_NOVO, 0, 3)).linhaCabecalho, 1);
});

test('colunas renomeadas continuam mapeando', () => {
  const r = interpretar(planilha(HEADER_RENOMEADO, 4, 3));
  assert.equal(r.veiculos[0]['Fabricante'], 'VOLKSWAGEN');
  assert.equal(r.veiculos[0]['Nome do motorista'], 'Motorista 0');
  assert.equal(r.veiculos[0]['Status'], 'Alugado');
  assert.equal(r.veiculos[0]['MARCA'], 'VOLKSWAGEN', 'mantém também o nome original');
});

test('linha em branco no meio não vira veículo fantasma', () => {
  const m = planilha(HEADER_NOVO, 9, 5);
  m.splice(12, 0, new Array(HEADER_NOVO.length).fill(''));
  assert.equal(interpretar(m).veiculos.length, 5);
});

test('sem coluna Placa devolve vazio, não lança', () => {
  const r = interpretar(planilha(['Frota', 'Modelo', 'Cor'], 3, 4));
  assert.equal(r.linhaCabecalho, null);
  assert.deepEqual(r.veiculos, []);
});

test('matriz vazia devolve vazio', () => {
  const r = interpretar([]);
  assert.equal(r.linhaCabecalho, null);
  assert.deepEqual(r.veiculos, []);
});

test('nenhuma chave é valor de dado — a quebra de 30/07', () => {
  const r = interpretar(planilha(HEADER_NOVO, 9, 20));
  const chaves = Object.keys(r.veiculos[0]);
  assert.ok(!chaves.some(k => /^[A-Z]{3}\d{4}$/.test(k)), `chaves suspeitas: ${chaves.slice(0, 5)}`);
});
