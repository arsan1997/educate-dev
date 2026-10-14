import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/pages/ExamTest.jsx',import.meta.url),'utf8');

test('continuous fireworks render above opaque scoreboard cards and remain non-interactive',()=>{
  assert.match(source,/\.fireworks-layer\s*\{[^}]*z-index:3;/s,'fireworks behind the z-index:2 content shell are hidden by opaque cards');
  assert.match(source,/\.fireworks-layer\s*\{[^}]*pointer-events:none;/s,'fireworks must never block scoreboard controls');
});

test('firework sparks are large enough to remain visible on a bright fullscreen display',()=>{
  assert.match(source,/\.firework i\s*\{[^}]*width:8px;[^}]*height:8px;/s);
  assert.match(source,/text-shadow|filter:drop-shadow/,'sparks need a visible edge or glow on the white scoreboard');
});
