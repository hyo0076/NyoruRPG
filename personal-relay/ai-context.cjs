'use strict';
const META = 'nyoru-relay/reusable-fields';
const REFERENCES = '_unchangedFields';
const MAX_BYTES = 2 * 1024 * 1024;
const MIN_FIELD_CHARS = 1024;
const object = value => value && typeof value === 'object' && !Array.isArray(value);

// Only object-key order changes. Array order, schema values and descriptions stay intact.
function stableObject(value) {
  if (Array.isArray(value)) return value.map(stableObject);
  if (!object(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableObject(value[key])]));
}

function reusableFields(result) {
  const meta = result._meta;
  if (!object(meta) || Object.keys(meta).length !== 1 || !Object.hasOwn(meta, META)) return null;
  const policy = meta[META];
  if (!object(policy) || policy.version !== 1 || !Array.isArray(policy.fields) || policy.fields.length > 16 ||
    Object.keys(policy).some(key => !['version', 'fields'].includes(key)) ||
    policy.fields.some(key => typeof key !== 'string' || !/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(key) ||
      ['constructor', 'prototype'].includes(key))) return null;
  return [...new Set(policy.fields)];
}

function createResultContext() {
  const snapshots = new Map();
  let bytes = 0;
  function remember(key, text, callId) {
    const previous = snapshots.get(key);
    if (previous) { bytes -= previous.bytes; snapshots.delete(key); }
    const size = Buffer.byteLength(text);
    if (size > MAX_BYTES - bytes) return;
    snapshots.set(key, {text, callId, bytes: size}); bytes += size;
  }
  function prepare(result, toolName, callId) {
    const original = JSON.stringify(result);
    const unchanged = {content: original, beforeChars: original.length, afterChars: original.length, reusedFields: 0};
    try { return format(result, toolName, callId, unchanged); }
    catch {
      // Presentation must not turn an already completed action into a failed call.
      snapshots.clear(); bytes = 0; return unchanged;
    }
  }
  function format(result, toolName, callId, unchanged) {
    // Rich MCP results and errors retain their entire envelope and metadata.
    if (!object(result) || result.isError !== undefined && result.isError !== false ||
      Object.keys(result).some(key => !['content', 'isError', '_meta'].includes(key)) ||
      !Array.isArray(result.content) || result.content.length !== 1) return unchanged;
    const block = result.content[0];
    if (!object(block) || block.type !== 'text' || typeof block.text !== 'string' ||
      Object.keys(block).some(key => !['type', 'text'].includes(key))) return unchanged;
    const fields = reusableFields(result);
    if (Object.hasOwn(result, '_meta') && fields === null) return unchanged;
    let value;
    try { value = JSON.parse(block.text); } catch {}
    if (object(value) && value.ok === false) return unchanged;
    const plain = {content: block.text, beforeChars: unchanged.beforeChars, afterChars: block.text.length, reusedFields: 0};
    if (!fields?.length || !object(value) || Object.hasOwn(value, REFERENCES)) return plain;

    const next = {...value}, references = Object.create(null), complete = [], reused = [];
    for (const field of fields) {
      if (!Object.hasOwn(value, field)) continue;
      const text = JSON.stringify(value[field]);
      const key = JSON.stringify([toolName, field]);
      const previous = snapshots.get(key);
      if (text.length >= MIN_FIELD_CHARS && previous?.text === text && previous.callId !== callId) {
        delete next[field]; references[field] = previous.callId; reused.push([key, text]);
      } else complete.push([key, text]);
    }
    if (reused.length) next[REFERENCES] = {
      toolCallIds: references,
      instruction: 'These fields are exactly unchanged. Use their complete values from the named earlier tool_call_id results in this conversation.'
    };
    const compact = reused.length ? JSON.stringify(next) : block.text;
    const useCompact = reused.length > 0 && compact.length < block.text.length;
    // Baselines always point to a full field, never to another reference.
    for (const [key, text] of useCompact ? complete : [...complete, ...reused]) remember(key, text, callId);
    return useCompact ? {content: compact, beforeChars: unchanged.beforeChars, afterChars: compact.length, reusedFields: reused.length} : plain;
  }
  return {prepare};
}

module.exports = {createResultContext, stableObject};
