'use strict';
// Minimal settings UI example. It intentionally does not persist credentials.
let client=null,generation=0;
const form=document.getElementById('connect-form'),status=document.getElementById('status');
const urlInput=document.getElementById('relay-url'),keyInput=document.getElementById('publisher-key');
const groupInput=document.getElementById('publisher-id'),endpoint=document.getElementById('endpoint');
const connectButton=document.getElementById('connect'),disconnectButton=document.getElementById('disconnect');
if(['http:','https:'].includes(location.protocol))urlInput.value=new URL('./',location.href).href.replace(/\/$/,'');

function lockInputs(locked){for(const input of [urlInput,keyInput,groupInput])input.disabled=locked;connectButton.disabled=locked;}
function resultFailure(code,message){return {isError:true,content:[{type:'text',text:JSON.stringify({ok:false,code,message})}]};}

// REPLACE 1: Public definitions shown to the model. Validate inputs in the handler too.
const tools=[{
  name:'add_numbers',description:'Add two finite numbers in the connected HTML page.',
  inputSchema:{type:'object',properties:{a:{type:'number'},b:{type:'number'}},required:['a','b'],additionalProperties:false},
  annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},timeoutMs:10000
}];

// REPLACE 2: Route to your plugin's existing functions, keeping its normal guards.
function handleCall(name,args,{signal}){
  if(signal.aborted)return resultFailure('CANCELLED','Cancelled before calculation.');
  if(name!=='add_numbers')return resultFailure('UNKNOWN_TOOL','This tool is not registered.');
  if(!Number.isFinite(args?.a)||!Number.isFinite(args?.b)||!Number.isFinite(args.a+args.b)||Object.keys(args).some(k=>!['a','b'].includes(k)))
    return resultFailure('INVALID_ARGUMENTS','Two finite numbers, a and b, are required.');
  const sum=args.a+args.b;
  document.getElementById('result').textContent='실제 도구 호출 수신 · '+args.a+' + '+args.b+' = '+sum;
  return {content:[{type:'text',text:JSON.stringify({sum})}]};
}

// REPLACE 3: Use the current document/chat identity in a real plugin.
// This calculation has no document data, so a fixed context is sufficient here.
const contextId='addition-demo-v1';

form.addEventListener('submit',async event=>{
  event.preventDefault();if(client)return;
  const ticket=++generation;
  lockInputs(true);disconnectButton.disabled=false;endpoint.value='';
  status.textContent='주소·인증·도구 등록을 확인하고 있습니다.';
  try{
    const next=new NyoruMcpRelay.RelayClient({url:urlInput.value.trim(),key:keyInput.value.trim(),
      publisherId:groupInput.value.trim(),name:'HTML 계산 예제',contextId,tools,handleCall,
      onStatus(update){
        if(ticket!==generation)return;
        status.textContent=({connected:'중계기 등록 완료 · AI 실제 호출은 별도로 확인합니다.',
          connecting:'중계기에 도구를 등록하고 있습니다.',reconnecting:'연결을 다시 확인 중입니다. 처리한 행동은 재실행하지 않습니다.',
          off:'연결이 중단되었습니다.',error:'연결 오류: '+update.code})[update.state]||update.state;
        if(update.state==='error'&&client){client=null;endpoint.value='';lockInputs(false);disconnectButton.disabled=true;}
      }});
    client=next;
    await next.start();
    if(ticket!==generation||client!==next)return;
    endpoint.value=next.endpoint;keyInput.value='';
  }catch(error){
    if(ticket!==generation)return;
    const stopped=client;client=null;if(stopped)await stopped.stop();
    if(ticket!==generation)return;
    status.textContent='등록하지 못했습니다. 주소·중계기·Publisher key를 확인하세요. ('+(error.code||'NETWORK')+')';
    lockInputs(false);disconnectButton.disabled=true;
  }
});

async function disconnect(){
  generation++;const stopped=client;client=null;
  endpoint.value='';status.textContent='연결을 해제했습니다.';keyInput.value='';
  lockInputs(false);disconnectButton.disabled=true;
  // Keep reconnect disabled until the previous binding has been released.
  connectButton.disabled=true;
  const ticket=generation;
  try{await stopped?.stop();}finally{if(ticket===generation)connectButton.disabled=false;}
}
disconnectButton.addEventListener('click',()=>{void disconnect();});
urlInput.addEventListener('input',()=>{keyInput.value='';});
window.addEventListener('pagehide',()=>{void disconnect();});
