import { test } from 'node:test';
import assert from 'node:assert/strict';
import { repair } from './recover.mjs';
const jump = '\n## Stage Jump\n**Timestamp**: 2026-10-10T01:51:21Z\n**Event**: STAGE_JUMPED\n**Direction**: REDO\n**Source**: code-generation\n**Target**: code-generation\n';
const start = '\n## Stage Start\n**Timestamp**: 2026-10-10T01:51:21Z\n**Event**: STAGE_STARTED\n**Stage**: code-generation\n**Agent**: aidlc-developer-agent\n';
test('removes only erroneous boundaries, preserving approvals and every other byte', () => { const a='approval bytes'; const b='test receipts'; const s=[a,jump,start,b].join('\n---\n'); const r=repair(s); assert.equal(r.text,[a,b].join('\n---\n')); assert.equal(r.removed.length,2); });
test('already corrected input is unchanged',()=>assert.deepEqual(repair('untouched'),{text:'untouched',removed:[]}));
test('incomplete correction fails closed',()=>assert.throws(()=>repair(jump),/exactly/));
test('unexpected event at timestamp fails closed',()=>assert.throws(()=>repair(start.replace('STAGE_STARTED','UNIT_COMPLETED')),/Unexpected/));
