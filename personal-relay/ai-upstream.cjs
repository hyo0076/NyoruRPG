'use strict';
const https = require('node:https');
const http = require('node:http');
const dns = require('node:dns').promises;
const {BlockList, isIP} = require('node:net');

const MAX_BYTES = 32 * 1024 * 1024;
const object = value => value && typeof value === 'object' && !Array.isArray(value);
function fault(code, message, status = 400) { return Object.assign(new Error(message), {code, status}); }
function check(ok, code, message, status) { if (!ok) throw fault(code, message, status); }

// Pin DNS answers to the actual connection; do not follow redirects with API credentials.
const blocked = new BlockList(), globalV6 = new BlockList();
for (const [address, prefix] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],
  ['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.88.99.0',24],['192.168.0.0',16],
  ['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',4],['240.0.0.0',4]]) blocked.addSubnet(address,prefix,'ipv4');
globalV6.addSubnet('2000::',3,'ipv6');
for (const [address,prefix] of [['2001::',23],['2001:db8::',32],['2002::',16]]) blocked.addSubnet(address,prefix,'ipv6');
function publicAddress(address) {
  const version = isIP(address);
  return version === 4 ? !blocked.check(address,'ipv4') : version === 6 && globalV6.check(address,'ipv6') && !blocked.check(address,'ipv6');
}
function targetUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw fault('AI_TARGET','원래 API 주소를 읽지 못했습니다.'); }
  check(url.protocol === 'https:' && !url.username && !url.password && !url.hash,
    'AI_TARGET','이 실험판은 HTTPS API 주소를 사용합니다.');
  const hostname = url.hostname.replace(/^\[|\]$/g,'').toLowerCase();
  check(!['localhost','localhost.localdomain'].includes(hostname) && !hostname.endsWith('.localhost') && !hostname.endsWith('.local') && (!isIP(hostname) || publicAddress(hostname)),
    'AI_TARGET','공개 HTTPS API 주소를 입력하세요.');
  return url;
}
function targetHeaders(encoded) {
  let value;
  try { value = JSON.parse(decodeURIComponent(encoded || '')); }
  catch { throw fault('AI_HEADERS','프로바이더가 보낸 API 인증 정보를 읽지 못했습니다.'); }
  check(object(value),'AI_HEADERS','API 요청 헤더가 올바르지 않습니다.');
  const headers = Object.create(null);
  const excluded = new Set(['host','connection','content-length','transfer-encoding','accept-encoding','cookie','origin','referer',
    'proxy-authorization','proxy-connection','te','trailer','upgrade','keep-alive','forwarded']);
  for (const [name,text] of Object.entries(value)) {
    const lower = name.toLowerCase();
    if (excluded.has(lower) || lower.startsWith('yumi-') || lower.startsWith('sec-') || lower.startsWith('x-forwarded-')) continue;
    check(typeof text === 'string','AI_HEADERS','API 요청 헤더 값이 올바르지 않습니다.');
    try { http.validateHeaderName(name); http.validateHeaderValue(name,text); }
    catch { throw fault('AI_HEADERS','API 인증 정보에 사용할 수 없는 문자가 있습니다.'); }
    headers[lower] = text;
  }
  headers['content-type'] = 'application/json';
  headers.accept = 'application/json';
  headers['accept-encoding'] = 'identity';
  // A provider retry key applies to its original request, not every inner model round.
  delete headers['idempotency-key'];
  delete headers['x-idempotency-key'];
  return headers;
}
async function readBody(req) {
  let size = 0; const pieces = [];
  for await (const chunk of req) {
    size += chunk.length;
    check(size <= MAX_BYTES,'AI_BODY_LIMIT','AI 요청이 32 MiB를 넘었습니다.',413);
    pieces.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(pieces).toString('utf8')); }
  catch { throw fault('AI_JSON','AI 요청 본문이 JSON이 아닙니다.'); }
}
async function requestJson(url, headers, payload, signal, method = 'POST') {
  signal.throwIfAborted();
  const hostname = url.hostname.replace(/^\[|\]$/g,''), ip = isIP(hostname);
  let records;
  try { records = ip ? [{address:hostname,family:ip}] : await dns.lookup(hostname,{all:true}); }
  catch { throw fault('AI_DNS','AI 서버 주소를 찾지 못했습니다.',502); }
  signal.throwIfAborted();
  check(records.length && records.every(row => publicAddress(row.address)), 'AI_TARGET','공개 HTTPS API 주소를 입력하세요.');
  const text = payload === undefined ? undefined : JSON.stringify(payload);
  check(!text || Buffer.byteLength(text) <= MAX_BYTES,'AI_BODY_LIMIT','도구 결과를 포함한 AI 요청이 32 MiB를 넘었습니다.',413);
  return new Promise((resolve,reject) => {
    const request = https.request(url, {method, headers, signal, agent:false,
      lookup(_host,options,callback) {
        const candidates = options.family ? records.filter(row => row.family === options.family) : records;
        if (!candidates.length) { callback(fault('AI_DNS','사용 가능한 AI 서버 주소가 없습니다.',502)); return; }
        if (options.all) callback(null,candidates);
        else callback(null,candidates[0].address,candidates[0].family);
      }
    }, response => {
      let size = 0; const pieces = [];
      response.on('data',chunk => {
        size += chunk.length;
        if (size > MAX_BYTES) response.destroy(fault('AI_RESPONSE_LIMIT','AI 응답이 32 MiB를 넘었습니다.',502));
        else pieces.push(chunk);
      });
      response.once('error',error => reject(error.status ? error : fault('AI_NETWORK','AI 응답 수신이 중단되었습니다.',502)));
      response.once('end',() => {
        const status = response.statusCode || 502;
        if (status < 200 || status >= 300) {
          const hint = status === 401 || status === 403 ? 'API 키와 모델 권한을 확인하세요.' : status === 429 ? 'API 사용 한도에 도달했습니다.' : 'AI 서버가 요청을 처리하지 못했습니다.';
          reject(fault('AI_UPSTREAM_HTTP',`AI 서버 응답 오류 (HTTP ${status}). ${hint}`,status >= 400 && status < 600 ? status : 502)); return;
        }
        try {
          const value = JSON.parse(Buffer.concat(pieces).toString('utf8'));
          // Provider error bodies can contain credentials or the original prompt.
          if (value?.error) reject(fault('AI_UPSTREAM_ERROR','AI 서버가 오류를 반환했습니다.',502));
          else resolve(value);
        } catch { reject(fault('AI_RESPONSE_FORMAT','AI 서버에서 Chat JSON 응답을 받지 못했습니다.',502)); }
      });
    });
    request.once('error',error => reject(signal.aborted ? signal.reason : error.status ? error : fault('AI_NETWORK','중계기에서 AI 서버에 연결하지 못했습니다.',502)));
    request.end(text);
  });
}
module.exports = {targetUrl,targetHeaders,readBody,requestJson,fault,check,object};
