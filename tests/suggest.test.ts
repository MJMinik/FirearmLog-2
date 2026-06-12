import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankSuggestions, recentValues } from '../src/lib/suggest.ts';

test('recentValues: distinct, newest first, most recent casing wins, blanks dropped', () => {
  const rows = [
    { date: '2026-06-01', value: 'shoot straight: university' },
    { date: '2026-06-10', value: 'Shoot Straight: University' },
    { date: '2026-06-05', value: 'Sarasota Gun Club' },
    { date: '2026-06-03', value: 'Ancient City Shooting Range' },
    { date: '2026-06-02', value: '   ' }
  ];
  assert.deepEqual(recentValues(rows), [
    'Shoot Straight: University', 'Sarasota Gun Club', 'Ancient City Shooting Range'
  ]);
});

test('rankSuggestions: typing "S" lists the S locations first', () => {
  const values = ['Shoot Straight: University', 'Sarasota Gun Club', 'Ancient City Shooting Range'];
  assert.deepEqual(rankSuggestions(values, 'S'), [
    'Shoot Straight: University', 'Sarasota Gun Club', 'Ancient City Shooting Range'
  ]); // the last one contains an "s" mid-word, so it trails the starts-with matches
  assert.deepEqual(rankSuggestions(values, 'sa'), ['Sarasota Gun Club']);
  assert.deepEqual(rankSuggestions(values, 'ancient'), ['Ancient City Shooting Range']);
});

test('rankSuggestions: empty query shows the recent list; exact match is hidden', () => {
  const values = ['A', 'B', 'C'];
  assert.deepEqual(rankSuggestions(values, ''), ['A', 'B', 'C']);
  assert.deepEqual(rankSuggestions(values, 'a'), []);
});

test('rankSuggestions caps the list', () => {
  const values = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'];
  assert.equal(rankSuggestions(values, 'S').length, 6);
  assert.equal(rankSuggestions(values, '', 3).length, 3);
});
