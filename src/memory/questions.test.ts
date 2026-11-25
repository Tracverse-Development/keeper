import { test } from 'node:test';
import assert from 'node:assert/strict';

import { argsProblem, cellText, columns, defaultArgs, groupQuestions, withoutPrefixes } from './questions.ts';

const q = (id: string, group: string, params: ('days' | 'category' | 'chat' | 'skill')[] = []) => ({ id, title: id, group, params });

test('questions group in the drawer order, catalog order kept inside a group', () => {
  const groups = groupQuestions([q('a', 'About me'), q('k1', 'Knowledge'), q('r', 'Reminders'), q('x', 'Later'), q('k2', 'Knowledge'), q('c', 'Conversations'), q('ac', 'Actions')]);
  assert.deepEqual(groups.map((g) => g.group), ['Knowledge', 'Conversations', 'Actions', 'Reminders', 'About me', 'Later']);
  assert.deepEqual(groups[0].questions.map((x) => x.id), ['k1', 'k2']);
  assert.deepEqual(groupQuestions([]), []);
});

test('inputs start at sensible defaults', () => {
  assert.deepEqual(defaultArgs([]), {});
  assert.deepEqual(defaultArgs(['days', 'category', 'chat', 'skill'], 'abc'), { days: '7', category: 'identity', chat: 'abc', skill: '' });
  assert.equal(defaultArgs(['chat']).chat, '');
});

test('inputs are checked before sending (the core checks again)', () => {
  assert.equal(argsProblem([], {}), null);
  assert.equal(argsProblem(['days'], { days: '7' }), null);
  assert.ok(argsProblem(['days'], { days: '0' }));
  assert.ok(argsProblem(['days'], { days: '3651' }));
  assert.ok(argsProblem(['days'], { days: '2.5' }));
  assert.ok(argsProblem(['category'], { category: 'x" } ?s ?p ?o {' }));
  assert.equal(argsProblem(['category'], { category: 'work' }), null);
  assert.ok(argsProblem(['chat'], { chat: '' }));
  assert.equal(argsProblem(['skill'], { skill: 'agent:Bash' }), null);
  assert.ok(argsProblem(['skill'], { skill: 'a" . ?x' }));
  assert.ok(argsProblem(['skill'], { skill: '' }));
});

test('answer tables take every key the rows carry, in first-seen order', () => {
  assert.deepEqual(columns([{ text: 'a', at: '1' }, { text: 'b', category: 'work', at: '2' }]), ['text', 'at', 'category']);
  assert.deepEqual(columns([]), []);
});

test('the SPARQL is shown without its prefixes', () => {
  const s = 'PREFIX desk: <https://umojaark.com/ns/desk#> PREFIX schema: <http://schema.org/> SELECT ?f WHERE { ?f a desk:Fact } LIMIT 5';
  assert.equal(withoutPrefixes(s), 'SELECT ?f WHERE { ?f a desk:Fact } LIMIT 5');
});

test('cells are plain text; IRIs keep their last segment', () => {
  assert.equal(cellText('urn:umoja:desk:fact:9f2a'), '9f2a');
  assert.equal(cellText('https://umojaark.com/ns/desk#Fact'), 'Fact');
  assert.equal(cellText('<b>hi</b>'), '<b>hi</b>');
  assert.equal(cellText(undefined), '');
});
