'use strict';
// No Risu imports, database access, or remote code execution. API keys stay in request memory.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {randomBytes, randomUUID, timingSafeEqual, createHash} = require('node:crypto');
const {createAiProxy} = require('./ai-proxy.cjs');
const VERSION = '0.1.1', PROTOCOL = 'nyoru-relay/1';
const EXPERIMENT = '';
const MCP_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const LIMIT = {body: 2 * 1024 * 1024, tools: 64, publishers: 16, sessions: 16,
  requests: 256, pending: 64, resultBytes: 16 * 1024 * 1024, lease: 60000, poll: 15000, idle: 1800000};
const idPattern = /^[A-Za-z0-9_-]{1,32}$/;
const object = x => x && typeof x === 'object' && !Array.isArray(x);
const digest = x => createHash('sha256').update(typeof x === 'string' ? x : JSON.stringify(x)).digest('hex');
const canonical = x => JSON.stringify(sort(x));
function sort(x) {
  if (Array.isArray(x)) return x.map(sort);
  if (!object(x)) return x;
  return Object.fromEntries(Object.keys(x).sort().map(k => [k, sort(x[k])]));
}
function fault(code, message, status = 400) { return Object.assign(new Error(message), {code, status}); }
function check(ok, code, message, status) { if (!ok) throw fault(code, message, status); }
function equal(a, b) {
  const aa = Buffer.from(String(a || '')), bb = Buffer.from(String(b || ''));
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}
function errorResult(code, message) {
  return {isError: true, content: [{type: 'text', text: JSON.stringify({ok: false, code, message,
    instruction: 'Do not automatically repeat this action. Inspect the original tool state or refresh its connection first.'})}]};
}
function options(argv) {
  const result = {host: '127.0.0.1', port: 18765, publicUrl: '', origins: [],
    config: path.join(__dirname, 'data', 'connection.json')};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (key === '--help') { result.help = true; continue; }
    if (key === '--console') { result.console = true; continue; }
    check(['--host', '--port', '--public-url', '--allow-origin', '--config'].includes(key) && argv[i + 1],
      'CLI_OPTION', '알 수 없거나 값이 빠진 실행 옵션입니다: ' + key);
    const value = argv[++i];
    if (key === '--allow-origin') result.origins.push(value);
    else result[{'--public-url': 'publicUrl', '--host': 'host', '--port': 'port', '--config': 'config'}[key]] = value;
  }
  result.port = Number(result.port);
  check(Number.isInteger(result.port) && result.port > 0 && result.port < 65536, 'PORT', '포트는 1부터 65535 사이의 정수여야 합니다.');
  if (result.publicUrl) {
    const url = new URL(result.publicUrl);
    check(['https:', 'http:'].includes(url.protocol) && !url.username && !url.password && !url.search && !url.hash,
      'PUBLIC_URL', '사용자명·비밀번호·쿼리·해시가 없는 HTTP(S) 기본 주소를 입력해 주세요.');
    result.publicUrl = url.href.replace(/\/$/, '');
  }
  for (const origin of result.origins) check(origin === 'null' || new URL(origin).origin === origin,
    'ORIGIN', '--allow-origin에는 경로 없이 정확한 출처를 입력해 주세요. 예: https://my-risu.example');
  // start.cmd runs outside the package. Keep its relative --config paths
  // relative to the package, and preserve normal CLI paths before changing cwd.
  result.config = path.resolve(result.console ? __dirname : process.cwd(), result.config);
  return result;
}
function configuration(filename) {
  if (fs.existsSync(filename)) {
    const data = JSON.parse(fs.readFileSync(filename, 'utf8'));
    check(data.version === 1 && ['publisherKey', 'consumerKey'].every(k => typeof data[k] === 'string' && data[k].length >= 32),
      'CONFIG', '중계기 연결 설정 파일이 올바르지 않습니다. 복구할 수 있도록 원본 파일을 보관해 주세요. 기존 키는 교체하지 않았습니다.');
    return data;
  }
  fs.mkdirSync(path.dirname(filename), {recursive: true});
  const data = {version: 1, publisherKey: randomBytes(32).toString('base64url'), consumerKey: randomBytes(32).toString('base64url')};
  fs.writeFileSync(filename, JSON.stringify(data, null, 2) + '\n', {flag: 'wx', mode: 0o600});
  return data;
}
function createRelay(config, opts) {
  const publishers = new Map(), bindings = new Map(), sessions = new Map(), calls = new Map();
  // Record connection boundaries, never headers, arguments, results, or binding tokens.
  const startedAt = new Date().toISOString(), events = [], totals = Object.create(null);
  let eventSequence = 0;
  const rpcMethods = new Set(['initialize', 'notifications/initialized', 'notifications/cancelled', 'ping', 'tools/list', 'tools/call']);
  const httpMethods = new Set(['GET', 'POST', 'DELETE', 'OPTIONS']);
  function trace(event, details = {}) {
    totals[event] = (totals[event] || 0) + 1;
    const row = {sequence: ++eventSequence, at: new Date().toISOString(), event};
    for (const key of ['route', 'method', 'rpc', 'code', 'publisher', 'tool', 'count', 'httpStatus', 'isError', 'beforeChars', 'afterChars', 'reusedFields']) {
      const value = details[key];
      if (typeof value === 'string') row[key] = value.slice(0, 96);
      else if (typeof value === 'number' || typeof value === 'boolean') row[key] = value;
    }
    events.push(row);
    if (events.length > 160) events.shift();
  }
  function diagnostics() {
    return {version: VERSION, experiment: EXPERIMENT, startedAt, capturedAt: new Date().toISOString(),
      totals: {...totals}, eventLimit: 160, events: events.map(row => ({...row}))};
  }
  function routeLabel(url) {
    const pathname = url.pathname;
    if (pathname === '/mcp' || /^\/mcp\/[A-Za-z0-9_-]{1,32}$/.test(pathname)) return 'mcp';
    if (pathname === '/ai' || /^\/ai\/[A-Za-z0-9_-]{1,32}$/.test(pathname)) return 'ai';
    const bridgeName = pathname.slice('/bridge/v1/'.length);
    if (pathname.startsWith('/bridge/v1/') && ['register', 'poll', 'result', 'unregister', 'status'].includes(bridgeName)) return 'bridge/' + bridgeName;
    return 'other';
  }
  let cachedBytes = 0, shuttingDown = false;
  const displayHost = opts.host === '0.0.0.0' || opts.host === '::' ? '127.0.0.1' : opts.host.includes(':') ? '[' + opts.host + ']' : opts.host;
  const baseUrl = opts.publicUrl || `http://${displayHost}:${opts.port}`;
  const configuredOrigins = new Set(['null', 'https://risuai.xyz', 'https://risuai.dev', ...opts.origins, new URL(baseUrl).origin]);
  const hostnames = new Set(['localhost', '127.0.0.1', '[::1]', opts.host, new URL(baseUrl).hostname]);
  for (const rows of Object.values(os.networkInterfaces())) for (const row of rows || []) hostnames.add(row.address.includes(':') ? '[' + row.address + ']' : row.address);
  function originAllowed(origin) {
    if (!origin || configuredOrigins.has(origin)) return true;
    try { const url = new URL(origin); return ['http:', 'https:'].includes(url.protocol) && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname); }
    catch { return false; }
  }
  function json(res, status, value, headers = {}) {
    if (res.writableEnded || res.destroyed) return;
    res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers});
    res.end(value === undefined ? '' : JSON.stringify(value));
  }
  async function body(req) {
    check((req.headers['content-type'] || '').toLowerCase().startsWith('application/json'), 'CONTENT_TYPE', 'Send application/json.', 415);
    let size = 0, pieces = [];
    for await (const chunk of req) {
      size += chunk.length;
      check(size <= LIMIT.body, 'BODY_LIMIT', 'Request exceeds 2 MiB.', 413);
      pieces.push(chunk);
    }
    try { return JSON.parse(Buffer.concat(pieces).toString('utf8')); }
    catch { throw fault('JSON', 'Invalid JSON.'); }
  }
  function auth(req, role) {
    const key = (req.headers.authorization || '').replace(/^Bearer /i, '');
    check(equal(key, config[role + 'Key']), 'AUTH', 'Connection key is missing or incorrect.', 401);
  }
  function finish(call, result) {
    if (!call || call.done) return;
    call.done = true; clearTimeout(call.timer); calls.delete(call.id);
    call.publisher.active.delete(call.id);
    call.resolve(result);
  }
  function cancel(call, reason) {
    if (!call || call.done) return;
    trace('call.cancelled', {publisher: call.publisher.id, tool: call.name, code: 'OUTCOME_UNCONFIRMED'});
    const p = call.publisher;
    p.queue = p.queue.filter(x => x.id !== call.id);
    if (call.delivered) p.cancellations.add(call.id);
    finish(call, errorResult('OUTCOME_UNCONFIRMED', reason)); wake(p);
  }
  function expire(p, reason) {
    if (publishers.get(p.id) !== p) return;
    trace('publisher.disconnected', {publisher: p.id});
    publishers.delete(p.id); bindings.delete(p.bindingId);
    for (const id of [...p.active]) cancel(calls.get(id), reason);
    if (p.poller) { const poller = p.poller; p.poller = null; clearTimeout(poller.timer); json(poller.res, 410, {code: 'BINDING_EXPIRED', message: reason}); }
  }
  function wake(p) {
    if (!p.poller || (!p.queue.length && !p.cancellations.size)) return;
    const poller = p.poller; p.poller = null; clearTimeout(poller.timer);
    const ready = p.queue.splice(0, 4).filter(x => !x.done);
    for (const item of ready) {
      item.delivered = true;
      trace('call.dispatched', {publisher: p.id, tool: item.name});
    }
    // Work is not requeued if this response is lost. Only its result may be retried.
    const cancellations = [...p.cancellations]; p.cancellations.clear();
    json(poller.res, 200, {calls: ready.map(c => ({id: c.id, name: c.name, arguments: c.args,
      contextId: p.contextId, timeoutMs: c.timeoutMs})), cancellations});
  }
  function binding(data) {
    const p = bindings.get(data.bindingId);
    check(p && Date.now() - p.lastSeen < LIMIT.lease, 'BINDING_EXPIRED', 'Publisher disconnected. Register again.', 410);
    p.lastSeen = Date.now(); return p;
  }
  function toolDefinitions(value) {
    check(Array.isArray(value) && value.length <= LIMIT.tools, 'TOOLS', 'Provide at most 64 tool definitions.');
    const seen = new Set();
    return value.map(t => {
      check(object(t) && typeof t.name === 'string' && /^[A-Za-z0-9_.-]{1,64}$/.test(t.name) && !seen.has(t.name), 'TOOL_NAME', 'Tool names must be unique, 1-64 ASCII name characters.');
      seen.add(t.name);
      check(object(t.inputSchema) && t.inputSchema.type === 'object', 'TOOL_SCHEMA', 'Each tool requires an object inputSchema.');
      check(!t.inputSchema.properties || object(t.inputSchema.properties), 'TOOL_SCHEMA', 'Schema properties must be an object.');
      check(t.inputSchema.required === undefined || Array.isArray(t.inputSchema.required) && t.inputSchema.required.every(k => typeof k === 'string'), 'TOOL_SCHEMA', 'Schema required must be an array of property names.');
      check(!Object.hasOwn(t.inputSchema.properties || {}, '_relayContext'), 'RESERVED_FIELD', '_relayContext is reserved by the relay.');
      check(t.description === undefined || typeof t.description === 'string', 'TOOL_SCHEMA', 'Description must be text.');
      check(t.title === undefined || typeof t.title === 'string', 'TOOL_SCHEMA', 'Title must be text.');
      const timeoutMs = t.timeoutMs ?? 600000;
      check(Number.isInteger(timeoutMs) && timeoutMs >= 1000 && timeoutMs <= 3600000, 'TIMEOUT', 'Tool timeout must be 1000-3600000 ms.');
      return {...t, timeoutMs};
    });
  }
  async function bridge(req, res, endpoint) {
    auth(req, endpoint === 'status' ? 'consumer' : 'publisher');
    if (endpoint === 'status') {
      check(req.method === 'GET', 'METHOD', 'Use GET.', 405);
      json(res, 200, {version: VERSION, activeCalls: calls.size, publishers: [...publishers.values()].map(p => ({id: p.id, name: p.name,
        tools: p.tools.length, online: Date.now() - p.lastSeen < LIMIT.lease, lastSeen: p.lastSeen,
        endpoint: baseUrl + '/mcp/' + p.id, aiEndpoint: baseUrl + '/ai/' + p.id})), diagnostics: diagnostics()}); return;
    }
    check(req.method === 'POST', 'METHOD', 'Use POST.', 405);
    const data = await body(req); check(object(data), 'BODY', 'Request must be an object.');
    if (endpoint === 'register') {
      check(data.protocol === PROTOCOL && idPattern.test(data.publisherId || '') && typeof data.instanceId === 'string' && data.instanceId.length > 0 && data.instanceId.length <= 128,
        'REGISTRATION', 'Protocol, publisherId, and instanceId are required.');
      check(typeof data.contextId === 'string' && data.contextId.length > 0 && data.contextId.length <= 256,
        'CONTEXT', 'Provide a nonempty contextId for the active document or chat.');
      const tools = toolDefinitions(data.tools), signature = canonical({contextId: data.contextId, tools});
      let p = publishers.get(data.publisherId);
      if (p && Date.now() - p.lastSeen >= LIMIT.lease) { expire(p, 'Publisher lease expired.'); p = null; }
      check(!p || p.instanceId === data.instanceId, 'PUBLISHER_BUSY', 'This publisher is open in another window. Close it or use a different publisherId.', 409);
      if (p && p.signature !== signature) { expire(p, 'Tool context changed. Refresh the provider tool list.'); p = null; }
      if (!p) {
        check(publishers.size < LIMIT.publishers, 'PUBLISHER_LIMIT', 'Publisher limit reached.', 429);
        p = {id: data.publisherId, name: String(data.name || data.publisherId).slice(0, 120), instanceId: data.instanceId,
          contextId: data.contextId, signature, tools, bindingId: randomUUID(), lastSeen: Date.now(),
          queue: [], active: new Set(), cancellations: new Set(), completed: new Map(), poller: null};
        publishers.set(p.id, p); bindings.set(p.bindingId, p);
        trace('publisher.registered', {publisher: p.id, count: tools.length});
      }
      p.lastSeen = Date.now(); json(res, 200, {protocol: PROTOCOL, bindingId: p.bindingId, leaseMs: LIMIT.lease, endpoint: baseUrl + '/mcp/' + p.id}); return;
    }
    const p = binding(data);
    if (endpoint === 'unregister') { expire(p, 'Publisher closed or changed context.'); json(res, 200, {ok: true}); return; }
    if (endpoint === 'poll') {
      check(!p.poller, 'POLL_BUSY', 'Only one poll may be active per publisher.', 409);
      // Empty long polls update counts without filling the recent-event window.
      totals['publisher.polls'] = (totals['publisher.polls'] || 0) + 1;
      const poller = {res, timer: null}; p.poller = poller;
      poller.timer = setTimeout(() => { if (p.poller === poller) { p.poller = null; json(res, 200, {calls: [], cancellations: []}); } }, LIMIT.poll);
      res.on('close', () => { if (p.poller === poller) { p.poller = null; clearTimeout(poller.timer); } });
      wake(p); return;
    }
    if (endpoint === 'result') {
      check(object(data.result) && Array.isArray(data.result.content), 'RESULT', 'Return an MCP CallToolResult with content.');
      const call = calls.get(data.callId), fingerprint = digest(canonical(data.result));
      if (p.completed.has(data.callId)) {
        check(p.completed.get(data.callId) === fingerprint, 'RESULT_CONFLICT', 'A different result was already acknowledged.', 409);
        json(res, 200, {ok: true, duplicate: true}); return;
      }
      check(call && call.publisher === p && call.delivered, 'CALL_EXPIRED', 'This call is no longer awaiting a result. Do not execute it again.', 410);
      check(object(data.result) && Array.isArray(data.result.content), 'RESULT', 'Return an MCP CallToolResult with content.');
      check(data.result.isError === undefined || typeof data.result.isError === 'boolean', 'RESULT', 'isError must be boolean.');
      trace('call.resultReceived', {publisher: p.id, tool: call.name, isError: data.result.isError === true});
      p.completed.set(call.id, fingerprint);
      while (p.completed.size > LIMIT.requests) p.completed.delete(p.completed.keys().next().value);
      finish(call, data.result); json(res, 200, {ok: true}); return;
    }
    throw fault('NOT_FOUND', 'Unknown bridge endpoint.', 404);
  }
  function catalog(session) {
    const rows = [], routes = new Map();
    for (const p of publishers.values()) {
      if (Date.now() - p.lastSeen >= LIMIT.lease || (session.filter && p.id !== session.filter)) continue;
      for (const t of p.tools) {
        const full = p.id + '__' + t.name;
        const name = full.length <= 64 ? full : full.slice(0, 53) + '_' + digest(full).slice(0, 10);
        check(!routes.has(name), 'TOOL_COLLISION', 'Tool alias collision. Rename the publisher or tool.');
        const {timeoutMs, ...definition} = t;
        const schema = {...t.inputSchema, properties: {...t.inputSchema.properties, _relayContext: {type: 'string', enum: [p.bindingId],
          description: 'Copy this exact connection token. Refresh tools/list after a document or chat changes.'}},
          required: [...new Set([...(t.inputSchema.required || []), '_relayContext'])]};
        rows.push({...definition, name, inputSchema: schema});
        routes.set(name, {publisher: p, originalName: t.name, bindingId: p.bindingId, timeoutMs});
      }
    }
    session.catalog = routes; return {tools: rows};
  }
  async function dispatch(session, request) {
    if (request.method === 'ping') return {};
    check(session.initialized, -32002, 'Send notifications/initialized first.');
    if (request.method === 'tools/list') {
      check(!request.params?.cursor, -32602, 'Pagination cursor is not used by this relay.');
      const result = catalog(session);
      trace('mcp.toolsListed', {publisher: session.filter || '*', count: result.tools.length});
      return result;
    }
    check(request.method === 'tools/call', -32601, 'Method not supported.');
    const params = request.params;
    let route = session.catalog.get(params?.name);
    // A client may cache definitions across sessions and call without listing again.
    // The exact binding token still rejects definitions from another chat or lease.
    if (!route) { catalog(session); route = session.catalog.get(params?.name); }
    if (!route || bindings.get(route.bindingId) !== route.publisher || Date.now() - route.publisher.lastSeen >= LIMIT.lease) {
      trace('call.rejected', {publisher: session.filter || '*', code: 'TOOL_OFFLINE'});
      return errorResult('TOOL_OFFLINE', 'Tool context is offline or changed. Refresh tools/list.');
    }
    if (!object(params.arguments) || params.arguments._relayContext !== route.bindingId) {
      trace('call.rejected', {publisher: route.publisher.id, tool: route.originalName, code: 'CONTEXT_CHANGED'});
      return errorResult('CONTEXT_CHANGED', 'The connection token does not match this tool list. Refresh tools/list before deciding the next action.');
    }
    check(calls.size < LIMIT.pending, -32005, 'Too many pending calls.');
    const {_relayContext, ...args} = params.arguments;
    return new Promise(resolve => {
      const p = route.publisher;
      const call = {id: randomUUID(), session, requestId: request.id, publisher: p, name: route.originalName,
        args, resolve, timeoutMs: route.timeoutMs, delivered: false, done: false};
      call.timer = setTimeout(() => cancel(call, 'Tool result timeout. The action may already have been saved; inspect its state before retrying.'), route.timeoutMs);
      calls.set(call.id, call); p.active.add(call.id); p.queue.push(call);
      trace('call.queued', {publisher: p.id, tool: call.name}); wake(p);
    });
  }
  function closeSession(session) {
    for (const call of [...calls.values()]) if (call.session === session) cancel(call, 'MCP session ended.');
    for (const entry of session.requests.values()) cachedBytes -= entry.bytes || 0;
    sessions.delete(session.id);
  }
  const aiProxy = createAiProxy({
    trace,
    authenticate(req) {
      check(typeof req.headers['yumi-auth'] === 'string' && equal(req.headers['yumi-auth'],config.consumerKey),
        'AUTH','프록시 인증 토큰에 Consumer key를 입력하세요.',401);
    },
    openContext(filter) {
      const session = {id:randomUUID(),filter,initialized:true,catalog:new Map(),requests:new Map()};
      const tools = catalog(session).tools;
      // Pin the exact publisher bindings before the first model request.
      const identity = [...session.catalog].map(([name,route]) => [name,route.bindingId]);
      return {filter,session,tools,identity};
    },
    assertContext(context) {
      for (const route of context.session.catalog.values()) check(bindings.get(route.bindingId) === route.publisher && Date.now()-route.publisher.lastSeen < LIMIT.lease,
        'CONTEXT_CHANGED','플러그인의 채팅 또는 연결이 바뀌어 처리를 중단했습니다.',409);
    },
    invoke(context,name,args) {
      const route = context.session.catalog.get(name);
      check(route,'AI_UNKNOWN_TOOL','등록되지 않은 도구입니다.');
      trace('call.received',{publisher:route.publisher.id,tool:route.originalName});
      return dispatch(context.session,{id:randomUUID(),method:'tools/call',params:{name,arguments:{...args,_relayContext:route.bindingId}}});
    },
    closeContext(context) { closeSession(context.session); }
  });
  async function mcp(req, res, filter, requestTrace) {
    auth(req, 'consumer');
    if (req.method === 'GET') { res.setHeader('Allow', 'POST, DELETE'); json(res, 405, {message: 'Use Streamable HTTP POST with JSON responses; standalone SSE is not provided.'}); return; }
    const sessionId = req.headers['mcp-session-id'];
    let session = sessionId && sessions.get(sessionId);
    if (sessionId) check(session && session.filter === filter, 'SESSION_EXPIRED', 'Session expired. Reinitialize; do not automatically repeat previous actions.', 404);
    if (req.method === 'DELETE') {
      check(session, 'SESSION', 'Mcp-Session-Id is required.'); closeSession(session); json(res, 200, {}); return;
    }
    check(req.method === 'POST', 'METHOD', 'Use POST.', 405);
    const request = await body(req);
    check(object(request) && request.jsonrpc === '2.0' && typeof request.method === 'string', 'RPC', 'Expected one JSON-RPC 2.0 object. Batches are not supported.');
    check(request.id === undefined || typeof request.id === 'string' || Number.isSafeInteger(request.id), 'RPC_ID', 'Request id must be a string or integer.');
    requestTrace.rpc = rpcMethods.has(request.method) ? request.method : 'other';
    if (request.method === 'tools/call') trace('call.received', {publisher: filter || '*'});
    const reply = value => {
      if (value.error) trace('mcp.rpcRejected', {rpc: requestTrace.rpc, publisher: filter || '*', code: value.error.code});
      if (request.method === 'tools/call') {
        const isError = !!value.error || value.result?.isError === true;
        if (res.destroyed || res.writableEnded) trace('call.responseLost', {publisher: filter || '*', isError});
        else {
          res.once('finish', () => trace('call.responseSent', {publisher: filter || '*', isError}));
          res.once('close', () => { if (!res.writableFinished) trace('call.responseLost', {publisher: filter || '*', isError}); });
        }
      }
      json(res, 200, {jsonrpc: '2.0', id: request.id, ...value}, session ? {'Mcp-Session-Id': session.id} : {});
    };
    if (request.method === 'initialize') {
      check(request.id !== undefined && !sessionId && object(request.params), 'INITIALIZE', 'Initialize requires an id and params, with no old session.');
      check(sessions.size < LIMIT.sessions, 'SESSION_LIMIT', 'Too many MCP sessions. Close old clients or wait for idle expiry.', 429);
      const version = MCP_VERSIONS.includes(request.params.protocolVersion) ? request.params.protocolVersion : MCP_VERSIONS[0];
      session = {id: randomUUID(), filter, protocol: version, lastSeen: Date.now(), initialized: false, catalog: new Map(), requests: new Map()};
      sessions.set(session.id, session);
      trace('mcp.initialized', {publisher: filter || '*'});
      reply({result: {protocolVersion: version, capabilities: {tools: {listChanged: false}},
        serverInfo: {name: 'nyoru-personal-relay', version: VERSION},
        instructions: 'Tools execute in the connected publisher, not on this server. Refresh the tool list after changing chats. Never retry uncertain actions automatically.'}}); return;
    }
    check(session, 'SESSION', 'Initialize first, then send Mcp-Session-Id.');
    if (req.headers['mcp-protocol-version']) check(req.headers['mcp-protocol-version'] === session.protocol, 'PROTOCOL_VERSION', 'Protocol version differs from this session.');
    session.lastSeen = Date.now();
    if (request.id === undefined) {
      if (request.method === 'notifications/initialized') { session.initialized = true; trace('mcp.ready', {publisher: filter || '*'}); }
      else if (request.method === 'notifications/cancelled') for (const call of [...calls.values()])
        if (call.session === session && call.requestId === request.params?.requestId) cancel(call, 'Client cancelled the request.');
      json(res, 202); return;
    }
    const key = typeof request.id + ':' + request.id, fingerprint = digest(canonical({method: request.method, params: request.params || {}}));
    let entry = session.requests.get(key);
    if (entry) {
      if (entry.fingerprint !== fingerprint) { reply({error: {code: -32600, message: 'The same request id cannot be reused for another request.'}}); return; }
    } else {
      if (session.requests.size >= LIMIT.requests || cachedBytes >= LIMIT.resultBytes) {
        reply({error: {code: -32005, message: 'Session cache limit reached. Reconnect before issuing new actions; do not retry an uncertain old action.'}}); return;
      }
      entry = {fingerprint, bytes: 0}; session.requests.set(key, entry);
      entry.promise = Promise.resolve().then(() => dispatch(session, request))
        .then(result => ({result}), error => ({error: {code: typeof error.code === 'number' ? error.code : -32603, message: error.message}}))
        .then(outcome => {
          const bytes = Buffer.byteLength(JSON.stringify(outcome));
          if (sessions.has(session.id) && cachedBytes + bytes <= LIMIT.resultBytes) { entry.bytes = bytes; cachedBytes += bytes; return outcome; }
          // Do not execute again when an old result is too large to keep.
          return {result: errorResult('RESULT_CACHE_LIMIT', 'The tool may have completed. Inspect its state; the relay could not retain this result.')};
        });
    }
    reply(await entry.promise);
  }
  const staticFiles = {'/': ['index.html', 'text/html'], '/dashboard.js': ['dashboard.js', 'text/javascript'],
    '/style.css': ['style.css', 'text/css'], '/example.html': ['example.html', 'text/html'], '/example.js': ['example.js', 'text/javascript']};
  // Load the fixed, small public assets once and close every file immediately.
  // Serving a page must not reopen the extracted folder on each request.
  const staticResponses = new Map(Object.entries(staticFiles).map(([route, [file, type]]) =>
    [route, {type, content: fs.readFileSync(path.join(__dirname, 'web', file))}]));
  const sdkPath = fs.existsSync(path.join(__dirname, 'client.js')) ? path.join(__dirname, 'client.js') : path.join(__dirname, '..', 'src', 'personal-relay-client.js');
  staticResponses.set('/client.js', {type: 'text/javascript', content: fs.readFileSync(sdkPath)});
  async function handle(req, res) {
    const requestTrace = {route: 'other', method: httpMethods.has(req.method) ? req.method : 'other'};
    try {
      const url = new URL(req.url, baseUrl), pathname = url.pathname;
      requestTrace.route = routeLabel(url);
      if (requestTrace.route === 'mcp') trace('mcp.httpReceived', requestTrace);
      check(!shuttingDown, 'SHUTTING_DOWN', 'Relay is stopping.', 503);
      const authority = new URL('http://' + req.headers.host);
      check(hostnames.has(authority.hostname), 'HOST', 'Host header is not configured for this private relay.', 403);
      check(originAllowed(req.headers.origin), 'ORIGIN', 'Origin is not allowed. Add its exact origin with --allow-origin.', 403);
      if (req.headers.origin) {
        res.setHeader('Access-Control-Allow-Origin', req.headers.origin); res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');
      }
      if (req.method === 'OPTIONS') {
        if (requestTrace.route === 'mcp') trace('mcp.preflightAllowed', requestTrace);
        res.writeHead(204, {'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type, Cache-Control, Mcp-Session-Id, MCP-Protocol-Version, Yumi-Url, Yumi-Headers, Yumi-Auth, Yumi-Method, Yumi-Body-Transform',
          'Access-Control-Allow-Private-Network': 'true', 'Access-Control-Max-Age': '600'}); res.end(); return;
      }
      if (pathname.startsWith('/bridge/v1/')) { await bridge(req, res, pathname.slice('/bridge/v1/'.length)); return; }
      if (pathname === '/mcp' || /^\/mcp\/[A-Za-z0-9_-]{1,32}$/.test(pathname)) { await mcp(req, res, pathname === '/mcp' ? '' : pathname.slice(5), requestTrace); return; }
      if (requestTrace.route === 'ai') { await aiProxy.handle(req,res,pathname === '/ai' ? '' : pathname.slice(4)); return; }
      check(req.method === 'GET', 'METHOD', 'Use GET for the connection page.', 405);
      const asset = staticResponses.get(pathname);
      check(asset, 'NOT_FOUND', 'Not found.', 404);
      res.writeHead(200, {'Content-Type': asset.type + '; charset=utf-8', 'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
        'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'"});
      res.end(asset.content);
    } catch (error) {
      trace('http.rejected', {...requestTrace, code: error.code || 'INTERNAL', httpStatus: error.status || 500});
      const failure = {code: error.code || 'INTERNAL', message: error.status ? error.message : 'Relay request failed.'};
      json(res, error.status || 500, requestTrace.route === 'ai' ? {error:{type:'relay_error',...failure}} : failure);
    }
  }
  const server = http.createServer((req, res) => { void handle(req, res); });
  server.requestTimeout = 30000; server.headersTimeout = 15000;
  server.maxConnections = 128;
  const sweep = setInterval(() => {
    const now = Date.now();
    aiProxy.sweep();
    for (const p of publishers.values()) if (now - p.lastSeen >= LIMIT.lease) expire(p, 'Publisher stopped responding. Inspect the original tool before retrying.');
    for (const s of sessions.values()) if (now - s.lastSeen >= LIMIT.idle && ![...calls.values()].some(c => c.session === s)) closeSession(s);
  }, 5000); sweep.unref();
  function close() {
    if (shuttingDown) return;
    shuttingDown = true; clearInterval(sweep);
    aiProxy.close();
    for (const p of [...publishers.values()]) expire(p, 'Personal relay is stopping.');
    for (const s of [...sessions.values()]) closeSession(s);
    // Give completed/cancelled replies a short chance to flush, then release
    // this server's remaining sockets, including incomplete request bodies.
    const forceClose = setTimeout(() => server.closeAllConnections(), 1000);
    forceClose.unref();
    server.close(() => clearTimeout(forceClose)); server.closeIdleConnections();
  }
  return {server, close, baseUrl};
}
if (require.main === module) {
  const consoleMode = process.argv.includes('--console');
  let waitingForExit = false;
  function pauseOnFailure() {
    if (!consoleMode || waitingForExit || !process.stdin.isTTY) return;
    waitingForExit = true;
    console.error('\n실행되지 않았습니다. 위 오류를 확인한 뒤 Enter를 누르거나 창을 닫으세요.');
    process.stdin.resume();
    process.stdin.once('data', () => { waitingForExit = false; process.stdin.pause(); });
  }
  try {
    const opts = options(process.argv.slice(2));
    // Direct Windows launches also release the package as Node's working dir.
    // Config paths are already absolute, so existing keys remain in place.
    if (process.platform === 'win32') process.chdir(path.parse(process.execPath).root);
    if (opts.help) console.log('실행 방법: node server.cjs [--port 18765] [--host 127.0.0.1] [--allow-origin https://your-risu.example] [--public-url https://your-relay.example] [--config path]');
    else {
      const config = configuration(opts.config), relay = createRelay(config, opts);
      relay.server.once('error', error => {
        console.error(error.code === 'EADDRINUSE'
          ? `${opts.port}번 포트를 다른 프로그램이 사용 중입니다. 기존 프로그램은 그대로 두었습니다. --port 옵션에 다른 포트 번호를 지정해 중계기를 다시 실행해 주세요.`
          : '중계기를 시작하지 못했습니다. 오류 코드: ' + error.code);
        relay.close(); process.exitCode = 1; pauseOnFailure();
      });
      relay.server.listen(opts.port, opts.host, () => {
        console.log(`Nyoru 개인 MCP 중계기 ${VERSION}\n연결 안내 페이지: ${relay.baseUrl}/\n※ 위 주소를 인터넷 브라우저 주소창에 복사해 주세요.\nMCP 연결 주소: ${relay.baseUrl}/mcp\nAI 프록시 주소: ${relay.baseUrl}/ai`);
        console.log('등록용 키 (Publisher key · 플러그인 / HTML): ' + config.publisherKey);
        console.log('호출용 키 (Consumer key · 프록시 인증 토큰 / MCP Bearer): ' + config.consumerKey);
        console.log('연결키 저장 위치: ' + opts.config);
        console.log('\n중계기를 사용하는 동안 이 실행창을 켜 두세요. 최소화해도 계속 실행됩니다.\n이 실행창을 닫거나 Ctrl+C를 누르면 중계기가 종료됩니다.\n브라우저의 연결 안내 페이지만 닫으면 중계기는 계속 실행됩니다.');
      });
      const stop = () => { waitingForExit = false; process.stdin.pause(); relay.close(); };
      process.once('SIGINT', stop); process.once('SIGTERM', stop); process.once('SIGHUP', stop);
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; pauseOnFailure(); }
}
module.exports = {createRelay, options};
