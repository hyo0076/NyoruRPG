'use strict';
const base=new URL('./',location.href).href.replace(/\/$/,'');
document.getElementById('base-url').textContent=base;
document.getElementById('mcp-url').textContent=base+'/mcp';
document.getElementById('ai-all-url').textContent=base+'/ai';
const providerSettings=document.getElementById('provider-settings'),choice=document.getElementById('publisher-choice');
const mode=document.getElementById('connection-mode');
mode.addEventListener('change',()=>{
  document.getElementById('ai-settings').hidden=mode.value!=='ai';
  document.getElementById('mcp-settings').hidden=mode.value!=='mcp';
});
const diagnosticPanel=document.getElementById('relay-diagnostics'),diagnosticDownload=document.getElementById('diagnostic-download');
let diagnosticSnapshot=null;
function showDiagnostics(data){
  if(!data?.diagnostics?.totals)return;
  diagnosticSnapshot=data.diagnostics;
  const count=event=>Number.isSafeInteger(diagnosticSnapshot.totals[event])?diagnosticSnapshot.totals[event]:0;
  document.getElementById('ai-diagnostic-counts').textContent='AI 요청 '+count('ai.requestReceived')+'회 · 도구 실행 요청 '+count('ai.toolRequested')+'회 · 답변 완료 '+count('ai.completed')+'회 · 중단 '+count('ai.failed')+'회';
  document.getElementById('diagnostic-counts').textContent='도구 목록 조회 '+count('mcp.toolsListed')+'회 · 호출 도착 '+count('call.received')+'회 · 플러그인 전달 시도 '+count('call.dispatched')+'회 · 결과 수신 '+count('call.resultReceived')+'회';
  const blocked=(diagnosticSnapshot.events||[]).filter(row=>['http.rejected','mcp.rpcRejected','call.rejected','call.cancelled','call.responseLost','ai.failed'].includes(row.event)).at(-1);
  const labels={AUTH:'연결키 거절',ORIGIN:'접속 출처 거절',HOST:'접속 주소 거절',SESSION_EXPIRED:'MCP 연결 만료',SESSION:'MCP 연결 정보 누락',PROTOCOL_VERSION:'연결 규격 불일치',CONTEXT_CHANGED:'채팅 또는 도구 연결 변경',TOOL_OFFLINE:'도구 연결이 끊기거나 바뀜',BINDING_EXPIRED:'플러그인 연결 만료',OUTCOME_UNCONFIRMED:'호출 취소 또는 대기시간 초과',AI_TOOL_CONFLICT:'모델의 도구 사용을 꺼 주세요',AI_NO_TOOLS:'선택한 그룹의 도구 연결 없음',AI_CHAT_FORMAT:'OpenAI 호환 · Chat 모델 필요',AI_CANCELLED:'AI 요청 취소',AI_NETWORK:'중계기와 AI 서버 연결 실패',AI_DNS:'AI 서버 주소 조회 실패',AI_UPSTREAM_HTTP:'AI 서버 오류',AI_UPSTREAM_ERROR:'AI 서버 오류',AI_TOOL_UNSETTLED:'도구 실행 결과 미확인',AI_TIMEOUT:'AI 처리 대기시간 초과',AI_ALREADY_RUNNING:'같은 요청 처리 중',AI_BUSY:'다른 요청 처리 중',AI_EMPTY_ANSWER:'AI 최종 답변 누락',AI_CALL_LIMIT:'한 답변의 도구 호출 한도 도달'};
  document.getElementById('diagnostic-last-event').textContent=blocked?
    '최근 중단: '+new Date(blocked.at).toLocaleTimeString()+' · '+(labels[blocked.code]||blocked.code||'응답 연결 끊김'):
    '지금까지 중계기에서 기록한 거절은 없습니다.';
  diagnosticPanel.hidden=false;
}
function downloadDiagnostics(){
  if(!diagnosticSnapshot)return;
  const url=URL.createObjectURL(new Blob([JSON.stringify(diagnosticSnapshot,null,2)],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download='Nyoru-MCP-중계기-진단.json';
  document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function selectPublisher(){
  const id=choice.value?encodeURIComponent(choice.value):'';
  document.getElementById('provider-url').textContent=id?base+'/mcp/'+id:'';
  document.getElementById('ai-url').textContent=id?base+'/ai/'+id:'';
}
choice.addEventListener('change',selectPublisher);
function clearResults(){
  providerSettings.hidden=true;choice.replaceChildren();selectPublisher();
  document.getElementById('publishers').replaceChildren();
  diagnosticSnapshot=null;diagnosticPanel.hidden=true;
}
let lookup=0,activeRequest;
document.getElementById('consumer-key').addEventListener('input',()=>{
  lookup++;activeRequest?.abort();clearResults();
  document.querySelector('#status-form button').disabled=false;
  document.getElementById('status').textContent='키를 입력한 뒤 도구·주소 확인을 누르세요.';
});
async function refreshStatus(download=false){
  const status=document.getElementById('status'),list=document.getElementById('publishers'),button=document.querySelector('#status-form button');
  const key=document.getElementById('consumer-key').value.trim();
  if(!key){clearResults();status.textContent='실행창의 Consumer key 값을 입력하세요.';return;}
  const previous=choice.value,request=++lookup,controller=new AbortController();
  activeRequest?.abort();activeRequest=controller;
  const timer=setTimeout(()=>controller.abort(),10000);
  button.disabled=true;diagnosticDownload.disabled=true;status.textContent='등록된 도구를 확인하고 있습니다.';clearResults();
  try{
    const response=await fetch(base+'/bridge/v1/status',{headers:{Authorization:'Bearer '+key},signal:controller.signal,cache:'no-store'});
    if(!response.ok)throw new Error(response.status===401?'Consumer key가 맞지 않습니다. Publisher key가 아닌 호출용 키를 넣어 주세요.':'도구 목록을 읽지 못했습니다. (HTTP '+response.status+')');
    const data=await response.json();
    if(!Array.isArray(data.publishers))throw new Error('중계기 응답을 읽지 못했습니다. 중계기 주소를 확인하세요.');
    if(request!==lookup)return;
    showDiagnostics(data);
    const online=data.publishers.filter(p=>p.online&&p.tools>0);
    status.textContent=online.length?'확인 완료 · 연결 중인 그룹 '+online.length+'개 · 도구 '+online.reduce((sum,p)=>sum+p.tools,0)+'개':'등록된 그룹은 있지만 연결 중인 도구가 없습니다. 해당 플러그인을 열고 다시 연결하세요.';
    for(const publisher of data.publishers){
      const row=document.createElement('p');
      row.textContent=publisher.name+' · '+(publisher.online?'중계기에 연결됨':'연결 끊김')+' · 도구 '+publisher.tools+'개';list.append(row);
    }
    for(const publisher of online){
      const option=document.createElement('option');option.value=publisher.id;
      option.textContent=publisher.name+' ('+publisher.id+') · 도구 '+publisher.tools+'개';choice.append(option);
    }
    if(online.some(p=>p.id===previous))choice.value=previous;
    selectPublisher();providerSettings.hidden=!online.length;
    if(!data.publishers.length)status.textContent='등록된 도구가 없습니다. 사용할 플러그인에 기본 주소와 Publisher key를 넣고 연결한 뒤 다시 확인하세요.';
    if(download)downloadDiagnostics();
  }catch(error){if(request===lookup){clearResults();status.textContent=controller.signal.aborted?'10초 안에 응답을 받지 못했습니다. 중계기 실행창이 열려 있는지 확인하세요.':error instanceof TypeError?'중계기에 접속하지 못했습니다. 중계기 실행창이 열려 있는지 확인하세요.':error.message||'도구 목록을 읽지 못했습니다.';}}
  finally{clearTimeout(timer);if(request===lookup){activeRequest=null;button.disabled=false;diagnosticDownload.disabled=false;}}
}
document.getElementById('status-form').addEventListener('submit',event=>{event.preventDefault();void refreshStatus();});
diagnosticDownload.addEventListener('click',()=>{void refreshStatus(true);});
document.querySelectorAll('[data-copy]').forEach(button=>button.addEventListener('click',async()=>{
  const source=document.getElementById(button.dataset.copy),value=source.textContent;
  if(!value)return;
  const status=document.getElementById('copy-status');
  try{await navigator.clipboard.writeText(value);status.textContent='주소를 복사했습니다.';}
  catch{const range=document.createRange();range.selectNodeContents(source);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);status.textContent='자동 복사를 사용할 수 없어 주소를 선택했습니다. 선택된 주소를 복사하세요.';}
}));
window.addEventListener('pagehide',()=>{
  lookup++;activeRequest?.abort();document.getElementById('consumer-key').value='';clearResults();
  document.querySelector('#status-form button').disabled=false;document.getElementById('status').textContent='Consumer key를 입력하고 도구·주소 확인을 누르세요.';
});
