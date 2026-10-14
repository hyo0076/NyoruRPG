'use strict';
const {createHash} = require('node:crypto');
const {targetUrl,targetHeaders,readBody,requestJson,fault,check,object} = require('./ai-upstream.cjs');
const {createResultContext,stableObject} = require('./ai-context.cjs');

const LIMIT = {concurrent:2,requests:128,cacheBytes:16*1024*1024,ttl:30*60*1000,timeout:30*60*1000,rounds:16,calls:64,tools:128};
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const stopCodes = new Set(['OUTCOME_UNCONFIRMED','CONTEXT_CHANGED','TOOL_OFFLINE','BINDING_EXPIRED','RESULT_CACHE_LIMIT',
  'CALL_EXPIRED','CANCELLED','ABORTED','HOST_SCOPE_CHANGED','SCOPE_CHANGED','GENERATION_CANCELLED']);

function resultCode(result) {
  if (typeof result?.structuredContent?.code === 'string') return result.structuredContent.code;
  for (const block of result?.content || []) {
    if (block.type !== 'text') continue;
    try { const value = JSON.parse(block.text); if (typeof value?.code === 'string') return value.code; } catch {}
  }
  return '';
}
function addUsage(total, usage) {
  for (const [key,value] of Object.entries(usage)) {
    if (typeof value === 'number' && Number.isFinite(value)) total[key] = (typeof total[key] === 'number' ? total[key] : 0) + value;
    else if (object(value)) { if (!object(total[key])) total[key] = Object.create(null); addUsage(total[key],value); }
  }
}
function validateRequest(body) {
  check(object(body) && typeof body.model === 'string' && body.model.length > 0 && Array.isArray(body.messages) && body.messages.length > 0,
    'AI_CHAT_FORMAT','OpenAI 호환 · Chat 모델을 선택하세요.');
  check(body.n === undefined || body.n === 1,'AI_CHOICES','한 번에 생성하는 답변 수를 1로 설정하세요.');
  check(body.stream === undefined || typeof body.stream === 'boolean','AI_CHAT_FORMAT','stream 값은 true 또는 false여야 합니다.');
  check((body.tools === undefined || Array.isArray(body.tools) && !body.tools.length) &&
    (body.functions === undefined || Array.isArray(body.functions) && !body.functions.length),
    'AI_TOOL_CONFLICT','이 모델의 도구 사용을 끄고 다시 요청하세요. 도구는 중계기가 전달합니다.');
  check(!body.modalities || Array.isArray(body.modalities) && body.modalities.every(value => value === 'text'),
    'AI_CHAT_FORMAT','이 실험판은 텍스트 답변을 사용합니다.');
}
function functionTools(definitions) {
  const names = new Set();
  return definitions.map(tool => {
    // Chat function names are narrower than MCP names. The route stays explicit.
    let name = tool.name.replace(/[^A-Za-z0-9_-]/g,'_');
    if (name !== tool.name) name = name.slice(0,51) + '_' + hash(tool.name).slice(0,12);
    check(!names.has(name),'AI_TOOL_COLLISION','도구 이름이 겹칩니다. 그룹 이름을 변경하세요.');
    names.add(name);
    const {properties,required,...rest} = tool.inputSchema;
    const {_relayContext,...fields} = properties || {};
    return {routeName:tool.name, definition:stableObject({type:'function',function:{name,
      description:tool.description || tool.title || tool.name,
      parameters:{...rest,properties:fields,required:(required || []).filter(key => key !== '_relayContext')}
    }})};
  }).sort((a,b) => a.definition.function.name < b.definition.function.name ? -1 : a.definition.function.name > b.definition.function.name ? 1 : 0);
}
function sendError(res,error) {
  if (res.destroyed || res.writableEnded) return;
  const value = {error:{type:'relay_error',code:error.code || 'AI_INTERNAL',message:error.message}};
  if (res.headersSent) res.end('data: ' + JSON.stringify(value) + '\n\ndata: [DONE]\n\n');
  else {
    res.writeHead(error.status || 500,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
    res.end(JSON.stringify(value));
  }
}
function sendCompletion(res, completion, streaming, includeUsage) {
  if (res.destroyed || res.writableEnded) return;
  if (!streaming) {
    res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
    res.end(JSON.stringify(completion)); return;
  }
  if (!res.headersSent) res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-store','X-Accel-Buffering':'no'});
  const {choices,usage,object:_object,...metadata} = completion;
  const choice = choices[0], {tool_calls,function_call,...message} = choice.message;
  const chunk = (delta,finish_reason,extra = {}) => ({...metadata,object:'chat.completion.chunk',
    choices:[{index:0,delta,finish_reason,logprobs:null}],...(includeUsage ? {usage:null} : {}),...extra});
  // The first experiment buffers inner rounds; final text follows the caller's wire format.
  res.write('data: ' + JSON.stringify(chunk(message,null)) + '\n\n');
  res.write('data: ' + JSON.stringify(chunk({},choice.finish_reason || 'stop')) + '\n\n');
  if (includeUsage && usage) res.write('data: ' + JSON.stringify({...metadata,object:'chat.completion.chunk',choices:[],usage}) + '\n\n');
  res.end('data: [DONE]\n\n');
}

function createAiProxy(hooks) {
  const requests = new Map(), controllers = new Set();
  const occupied = new Set();
  let cacheBytes = 0, active = 0;
  function sweep() {
    const now = Date.now();
    for (const [key,entry] of requests) if (!entry.running && now-entry.at >= LIMIT.ttl) {
      requests.delete(key); cacheBytes -= entry.bytes || 0;
    }
  }
  async function generate(body,url,headers,context,signal,entry) {
    const definitions = functionTools(context.tools), routes = new Map(definitions.map(row => [row.definition.function.name,row.routeName]));
    const messages = body.messages.slice(), usage = Object.create(null), resultsById = new Map();
    const resultContext = createResultContext();
    let usageComplete = true, callCount = 0;
    const payload = {...body,messages,stream:false,tools:definitions.map(row => row.definition),tool_choice:'auto',parallel_tool_calls:false};
    delete payload.stream_options; delete payload.functions; delete payload.function_call;
    hooks.trace('ai.toolsAttached',{publisher:context.filter || '*',count:definitions.length});
    for (let round = 0; round < LIMIT.rounds; round++) {
      signal.throwIfAborted(); hooks.assertContext(context);
      // Reserve the last round for a final answer using the results already returned.
      if (round === LIMIT.rounds-1 || callCount >= LIMIT.calls) payload.tool_choice = 'none';
      hooks.trace('ai.upstreamRequested',{publisher:context.filter || '*',count:round+1});
      const completion = await requestJson(url,headers,payload,signal);
      signal.throwIfAborted(); hooks.assertContext(context);
      check(object(completion) && Array.isArray(completion.choices) && completion.choices.length === 1 && object(completion.choices[0]?.message),
        'AI_RESPONSE_FORMAT','AI 서버에서 올바른 Chat 응답을 받지 못했습니다.',502);
      if (object(completion.usage)) addUsage(usage,completion.usage); else usageComplete = false;
      const choice = completion.choices[0], message = choice.message, calls = message.tool_calls || [];
      check(message.role === 'assistant' && Array.isArray(calls) && !message.function_call,
        'AI_RESPONSE_FORMAT','AI 서버의 도구 호출 형식이 올바르지 않습니다.',502);
      if (!calls.length) {
        check(choice.finish_reason !== 'tool_calls','AI_RESPONSE_FORMAT','AI가 도구 호출 내용을 반환하지 않았습니다.',502);
        check(typeof message.content === 'string' && message.content.trim() || message.refusal || choice.finish_reason === 'content_filter',
          'AI_EMPTY_ANSWER','AI가 최종 답변을 비워 두었습니다.',502);
        const output = {...completion};
        if (usageComplete && Object.keys(usage).length) output.usage = usage;
        else delete output.usage; // Partial counts must not masquerade as the total cost.
        return output;
      }
      check(choice.finish_reason !== 'length' && choice.finish_reason !== 'content_filter',
        'AI_INCOMPLETE_CALL','AI 도구 호출이 끝까지 생성되지 않았습니다. 실행하지 않았습니다.',502);
      check(payload.tool_choice !== 'none' && callCount + calls.length <= LIMIT.calls,
        'AI_CALL_LIMIT','한 답변의 도구 호출 한도에 도달했습니다.',409);
      const ids = new Set();
      // Validate the entire batch before executing its first member.
      const plans = calls.map(tool => {
        check(object(tool) && typeof tool.id === 'string' && tool.id.length > 0 && tool.id.length <= 256 && !ids.has(tool.id) && tool.type === 'function' && object(tool.function),
          'AI_TOOL_FORMAT','AI가 올바르지 않은 도구 호출을 반환했습니다.',502);
        ids.add(tool.id);
        const name = routes.get(tool.function.name);
        check(name,'AI_UNKNOWN_TOOL','AI가 등록되지 않은 도구를 요청했습니다.',502);
        let args;
        try { args = JSON.parse(tool.function.arguments); } catch { throw fault('AI_TOOL_ARGUMENTS','AI 도구 인수가 JSON이 아닙니다.',502); }
        check(object(args) && !Object.hasOwn(args,'_relayContext'),'AI_TOOL_ARGUMENTS','AI 도구 인수가 올바르지 않습니다.',502);
        const fingerprint = hash([name,args]), previous = resultsById.get(tool.id);
        check(!previous || previous.fingerprint === fingerprint,'AI_TOOL_ID_CONFLICT','AI가 같은 호출 ID로 다른 행동을 요청했습니다.',409);
        return {id:tool.id,name,args,fingerprint};
      });
      // Keep vendor-specific thought signatures and reasoning fields for the next round.
      messages.push(message);
      for (const plan of plans) {
        signal.throwIfAborted(); hooks.assertContext(context);
        let result = resultsById.get(plan.id)?.result;
        if (!result) {
          entry.toolsStarted = true; callCount++;
          hooks.trace('ai.toolRequested',{publisher:context.filter || '*',tool:plan.name});
          result = await hooks.invoke(context,plan.name,plan.args);
          signal.throwIfAborted(); hooks.assertContext(context);
          check(object(result) && Array.isArray(result.content),'AI_TOOL_RESULT','도구 결과를 읽지 못했습니다.',502);
          const code = resultCode(result);
          check(!stopCodes.has(code),'AI_TOOL_UNSETTLED','도구 실행 결과를 확정하지 못했습니다. 플러그인 기록을 확인하세요.',409);
          resultsById.set(plan.id,{fingerprint:plan.fingerprint,result});
        }
        const prepared = resultContext.prepare(result,plan.name,plan.id);
        hooks.trace('ai.toolContextPrepared',{publisher:context.filter || '*',tool:plan.name,
          beforeChars:prepared.beforeChars,afterChars:prepared.afterChars,reusedFields:prepared.reusedFields});
        messages.push({role:'tool',tool_call_id:plan.id,content:prepared.content});
      }
    }
    throw fault('AI_CALL_LIMIT','AI가 최종 답변을 반환하지 않았습니다.',409);
  }
  async function handle(req,res,filter) {
    const controller = new AbortController();
    let context, entry, requestKey, heartbeat, counted = false, timeout, reservations = [];
    const stop = () => {
      if (!controller.signal.aborted) controller.abort(fault('AI_CANCELLED','요청이 취소되었습니다.',409));
    };
    const disconnected = () => { if (!res.writableFinished) stop(); };
    const cancelTools = () => { if (context) hooks.closeContext(context); };
    try {
      hooks.authenticate(req);
      hooks.trace('ai.requestReceived',{publisher:filter || '*'});
      check(active < LIMIT.concurrent,'AI_BUSY','다른 AI 요청이 진행 중입니다.',409);
      active++; counted = true; controllers.add(controller);
      req.once('aborted',stop); res.once('close',disconnected); controller.signal.addEventListener('abort',cancelTools,{once:true});
      timeout = setTimeout(() => controller.abort(fault('AI_TIMEOUT','AI 처리 대기시간을 넘었습니다.',409)),LIMIT.timeout);
      check(!req.headers['yumi-body-transform'],'AI_CHAT_FORMAT','OpenAI 호환 · Chat 모델을 선택하세요.');
      const url = targetUrl(req.headers['yumi-url']), headers = targetHeaders(req.headers['yumi-headers']);
      const method = String(req.headers['yumi-method'] || req.method).toUpperCase();
      if (method === 'GET' && req.method === 'GET' && /\/models\/?$/.test(url.pathname)) {
        const models = await requestJson(url,headers,undefined,controller.signal,'GET');
        if (!res.destroyed) { res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify(models)); }
        return;
      }
      check(req.method === 'POST' && method === 'POST' && /\/chat\/completions\/?$/.test(url.pathname),
        'AI_CHAT_FORMAT','이 프록시는 OpenAI 호환 · Chat 요청을 받습니다.');
      const body = await readBody(req); validateRequest(body);
      controller.signal.throwIfAborted();
      context = hooks.openContext(filter);
      check(context.tools.length > 0,'AI_NO_TOOLS','이 그룹에 연결된 도구가 없습니다. 플러그인의 중계기 연결을 확인하세요.',409);
      check(context.tools.length <= LIMIT.tools,'AI_TOOL_LIMIT','연결된 도구가 128개를 넘었습니다. 개별 그룹 주소를 사용하세요.');
      sweep();
      requestKey = hash([url.href,headers,body,context.identity]);
      const previous = requests.get(requestKey);
      if (previous) {
        check(!previous.running,'AI_ALREADY_RUNNING','같은 답변을 이미 처리하고 있습니다.',409);
        if (previous.error) throw previous.error;
        check(previous.result,'AI_RESULT_EXPIRED','이 요청은 이미 처리했습니다. 플러그인의 기록을 확인하세요.',409);
        hooks.trace('ai.responseReused',{publisher:filter || '*'});
        sendCompletion(res,previous.result,body.stream === true,body.stream_options?.include_usage === true); return;
      }
      const identities = [...new Set(context.identity.map(row => row[1]))];
      check(identities.every(id => !occupied.has(id)),'AI_BUSY','같은 플러그인의 AI 요청이 진행 중입니다.',409);
      reservations = identities;
      for (const id of reservations) occupied.add(id);
      check(requests.size < LIMIT.requests,'AI_CACHE_FULL','최근 요청 기록이 가득 찼습니다. 잠시 뒤 다시 요청하세요.',429);
      entry = {running:true,at:Date.now(),bytes:0,toolsStarted:false}; requests.set(requestKey,entry);
      if (body.stream === true) {
        res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-store','X-Accel-Buffering':'no'});
        res.write(': relay processing\n\n');
        heartbeat = setInterval(() => { if (!res.destroyed && !res.writableEnded) res.write(': relay processing\n\n'); },10000);
      }
      const completion = await generate(body,url,headers,context,controller.signal,entry);
      controller.signal.throwIfAborted();
      const bytes = Buffer.byteLength(JSON.stringify(completion));
      if (cacheBytes + bytes <= LIMIT.cacheBytes) { entry.result = completion; entry.bytes = bytes; cacheBytes += bytes; }
      entry.running = false; entry.at = Date.now();
      hooks.trace('ai.completed',{publisher:filter || '*'});
      res.once('finish',() => hooks.trace('ai.responseSent',{publisher:filter || '*'}));
      sendCompletion(res,completion,body.stream === true,body.stream_options?.include_usage === true);
    } catch (cause) {
      const error = controller.signal.aborted ? controller.signal.reason : cause?.status ? cause : fault('AI_INTERNAL','중계기의 AI 요청 처리가 중단되었습니다.',500);
      if (entry) {
        entry.running = false; entry.at = Date.now();
        entry.error = entry.toolsStarted ? fault(error.code,error.message + ' 이미 실행한 도구는 자동으로 다시 실행하지 않습니다.',409) : error;
        // A failure before any tool can be retried after fixing the API connection.
        if (!entry.toolsStarted) { requests.delete(requestKey); cacheBytes -= entry.bytes || 0; }
      }
      hooks.trace('ai.failed',{publisher:filter || '*',code:error.code,httpStatus:error.status || 500});
      sendError(res,entry?.error || error);
    } finally {
      clearTimeout(timeout); clearInterval(heartbeat);
      req.off('aborted',stop); res.off('close',disconnected); controller.signal.removeEventListener('abort',cancelTools);
      if (context) hooks.closeContext(context);
      for (const id of reservations) occupied.delete(id);
      if (counted) active--;
      controllers.delete(controller);
    }
  }
  function close() {
    for (const controller of controllers) controller.abort(fault('AI_STOPPING','중계기가 종료되었습니다.',409));
    requests.clear(); cacheBytes = 0;
  }
  return {handle,close,sweep};
}
module.exports = {createAiProxy};
