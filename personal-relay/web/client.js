(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.NyoruMcpRelay=api;
})(globalThis,function(){
  'use strict';
  const PROTOCOL='nyoru-relay/1',MAX_BYTES=2*1024*1024;
  const fault=(code,message,status=0)=>Object.assign(new Error(message),{code,status});
  const uuid=()=>globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
  const resultError=(code,message)=>({isError:true,content:[{type:'text',text:JSON.stringify({ok:false,code,message})}]});
  function baseURL(value){
    const u=new URL(value);
    if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.search||u.hash)throw fault('RELAY_URL','Use an HTTP(S) base URL without credentials, query, or fragment.');
    return u.href.replace(/\/+$/,'');
  }
  class RelayClient {
    constructor(options){
      this.options=options;this.url=baseURL(options.url);this.key=String(options.key||'');
      if(!this.key)throw fault('RELAY_KEY','A publisher key is required.');
      if(!/^[A-Za-z0-9_-]{1,32}$/.test(options.publisherId||''))throw fault('RELAY_ID','publisherId must be 1-32 ASCII letters, digits, _ or -.');
      if(!options.contextId||typeof options.handleCall!=='function')throw fault('RELAY_CONFIG','contextId and handleCall are required.');
      this.fetcher=options.fetch||globalThis.fetch.bind(globalThis);this.instanceId=uuid();
      this.requests=new Set();this.jobs=new Map();this.waiters=new Set();this.cacheBytes=0;
      this.running=false;this.bindingId=null;this.epoch=0;this.endpoint=this.url+'/mcp/'+options.publisherId;
      this.activity={polls:0,callsReceived:0,lastPollAt:null,lastCallAt:null,lastResultAt:null,lastPollError:null};
    }
    trace(event,details={}){try{this.options.onDiagnostic?.(event,details);}catch{/* Diagnostics cannot interrupt delivery. */}}
    diagnostics(){return {...this.activity,running:this.running,bound:!!this.bindingId,state:this.status?.state||'off',code:this.status?.code||null,
      executing:[...this.jobs.values()].filter(job=>!job.done).length,pendingResults:[...this.jobs.values()].filter(job=>job.done&&!job.acknowledged).length};}
    report(state,code=''){
      this.status={state,code};try{this.options.onStatus?.(this.status);}catch{/* Status observers must not interrupt tool results. */}
    }
    async request(path,data,timeoutMs=10000){
      const controller=new AbortController();this.requests.add(controller);
      let timer,abort;
      try{
        const encoded=JSON.stringify(data);
        if(new TextEncoder().encode(encoded).length>MAX_BYTES)throw fault('REQUEST_LIMIT','Relay request exceeds 2 MiB.');
        const interrupted=new Promise((_,reject)=>{
          abort=()=>reject(fault('CANCELLED','Relay request was interrupted.'));
          controller.signal.addEventListener('abort',abort,{once:true});
          timer=setTimeout(()=>controller.abort(),timeoutMs);
        });
        const send=async()=>{
          const response=await this.fetcher(this.url+'/bridge/v1/'+path,{method:'POST',
            headers:{'Content-Type':'application/json',Authorization:'Bearer '+this.key},body:encoded,
            signal:controller.signal});
          let value;try{value=await response.json();}catch{throw fault('RELAY_RESPONSE','Relay returned an unreadable response.',response.status);}
          if(!response.ok)throw fault(typeof value?.code==='string'?value.code:'RELAY_HTTP','Relay request failed (HTTP '+response.status+').',response.status);
          return value;
        };
        return await Promise.race([send(),interrupted]);
      }finally{clearTimeout(timer);controller.signal.removeEventListener('abort',abort);this.requests.delete(controller);}
    }
    sleep(ms){return new Promise(resolve=>{
      const wake=()=>{clearTimeout(timer);this.waiters.delete(wake);resolve();};
      const timer=setTimeout(wake,ms);this.waiters.add(wake);
    });}
    async register(epoch){
      this.report('connecting');
      const response=await this.request('register',{protocol:PROTOCOL,publisherId:this.options.publisherId,
        name:this.options.name||this.options.publisherId,instanceId:this.instanceId,contextId:this.options.contextId,
        tools:this.options.tools});
      if(!this.running||epoch!==this.epoch){
        await this.request('unregister',{bindingId:response.bindingId},3000).catch(()=>{});return false;
      }
      if(response.protocol!==PROTOCOL||typeof response.bindingId!=='string')throw fault('RELAY_PROTOCOL','Relay registration format differs.');
      const previous=this.bindingId;
      if(previous&&previous!==response.bindingId){
        for(const job of this.jobs.values())job.controller.abort();
        this.jobs.clear();this.cacheBytes=0;
      }
      this.bindingId=response.bindingId;this.report('connected');return true;
    }
    async start(){
      if(this.running)return;
      this.running=true;const epoch=++this.epoch;
      try{if(await this.register(epoch))void this.poll(epoch);}
      catch(error){if(epoch===this.epoch){await this.stop();this.report('error',error.code||'RELAY_NETWORK');}throw error;}
    }
    async poll(epoch){
      let failures=0;
      while(this.running&&epoch===this.epoch){
        try{
          const bindingId=this.bindingId;
          const packet=await this.request('poll',{bindingId},25000);
          if(!this.running||epoch!==this.epoch||this.bindingId!==bindingId)break;
          if(!Array.isArray(packet.calls)||!Array.isArray(packet.cancellations))throw fault('RELAY_RESPONSE','Invalid relay poll response.');
          this.activity.polls++;this.activity.lastPollAt=Date.now();this.activity.lastPollError=null;
          if(this.pollReadyBinding!==bindingId){this.pollReadyBinding=bindingId;this.trace('PollReady');}
          failures=0;this.report('connected');
          for(const id of packet.cancellations)this.jobs.get(id)?.controller.abort();
          for(const call of packet.calls)this.accept(call,bindingId,epoch);
        }catch(error){
          if(!this.running||epoch!==this.epoch)break;
          this.activity.lastPollError=error.code||'RELAY_NETWORK';
          if(error.status===401||error.status===403){await this.stop();this.report('error',error.code);break;}
          this.report('reconnecting',error.code||'RELAY_NETWORK');
          await this.sleep(Math.min(8000,1000*2**Math.min(failures++,3)));
          if(!this.running||epoch!==this.epoch)break;
          try{await this.register(epoch);}catch(registration){
            if(registration.status===401||registration.status===403||registration.code==='PUBLISHER_BUSY'){
              await this.stop();this.report('error',registration.code);break;
            }
          }
        }
      }
    }
    accept(call,bindingId,epoch){
      if(typeof call?.id!=='string'){this.trace('CallRejected',{phase:'envelope',code:'RELAY_RESPONSE'});return;}
      const previous=this.jobs.get(call.id);
      if(previous){if(previous.done&&!previous.sending)void this.deliver(previous,epoch);return;}
      const job={id:call.id,tool:typeof call.name==='string'?call.name.slice(0,160):null,bindingId,controller:new AbortController(),done:false,sending:false,bytes:0};
      this.activity.callsReceived++;this.activity.lastCallAt=Date.now();
      this.trace('CallReceived',{relayCallId:job.id,tool:job.tool,phase:'arrival'});
      this.jobs.set(call.id,job);
      void this.execute(job,call,epoch);
    }
    async execute(job,call,epoch){
      let timer,abort,result,phase='context';
      try{
        if(call.contextId!==this.options.contextId)throw fault('CONTEXT_CHANGED','The active document changed. Refresh tools/list.');
        phase='capacity';
        if([...this.jobs.values()].filter(x=>!x.done).length>64)throw fault('BUSY','Publisher has too many pending requests.');
        const interrupted=new Promise((_,reject)=>{
          abort=()=>reject(fault('CANCELLED','Tool interrupted. Its state may already be saved; do not repeat automatically.'));
          job.controller.signal.addEventListener('abort',abort,{once:true});
          timer=setTimeout(()=>job.controller.abort(),Math.min(3600000,Math.max(1000,Number(call.timeoutMs)||600000)));
        });
        phase='handler';
        result=await Promise.race([Promise.resolve().then(()=>{
          if(job.controller.signal.aborted)throw fault('CANCELLED','Tool cancelled before execution.');
          return this.options.handleCall(call.name,call.arguments,{signal:job.controller.signal,callId:call.id,contextId:call.contextId});
        }),interrupted]);
        phase='result-encoding';
        if(!Array.isArray(result?.content))result={content:[{type:'text',text:typeof result==='string'?result:JSON.stringify(result??null)}]};
        // Retain a detached result for delivery retries; never invoke the handler again.
        result=JSON.parse(JSON.stringify(result));
        const bytes=new TextEncoder().encode(JSON.stringify(result)).length;
        if(bytes>MAX_BYTES-1024||this.cacheBytes+bytes>16*1024*1024)throw fault('RESULT_LIMIT','The tool may have completed, but its result exceeds the relay limit. Inspect the original tool state.');
      }catch(error){
        this.trace('CallRejected',{relayCallId:job.id,tool:job.tool,phase,code:error.code||'TOOL_FAILED'});
        result=resultError(error.code||'TOOL_FAILED',error.code?String(error.message).slice(0,1000):'The tool failed. Check its own diagnostics before retrying.');
      }
      finally{clearTimeout(timer);job.controller.signal.removeEventListener('abort',abort);}
      job.result=result;job.done=true;job.bytes=new TextEncoder().encode(JSON.stringify(result)).length;
      this.trace('CallCompleted',{relayCallId:job.id,tool:job.tool,isError:result.isError===true,bytes:job.bytes});
      if(this.jobs.get(job.id)!==job)return;
      this.cacheBytes+=job.bytes;
      await this.deliver(job,epoch);
      // Completed, acknowledged calls have bounded duplicate protection. Active calls are never evicted.
      for(const [id,old] of this.jobs){
        if(this.jobs.size<=256)break;
        if(old.done&&old.acknowledged){this.jobs.delete(id);this.cacheBytes-=old.bytes;}
      }
    }
    async deliver(job,epoch){
      if(job.sending)return;job.sending=true;
      try{
        while(this.running&&epoch===this.epoch&&job.bindingId===this.bindingId){
          try{
            await this.request('result',{bindingId:job.bindingId,callId:job.id,result:job.result});job.acknowledged=true;
            this.activity.lastResultAt=Date.now();
            this.trace('ResultAccepted',{relayCallId:job.id,tool:job.tool,isError:job.result.isError===true});return;
          }
          catch(error){
            if([400,401,403,409,410,413].includes(error.status)){
              job.acknowledged=true;this.trace('ResultRejected',{relayCallId:job.id,tool:job.tool,code:error.code||'RELAY_HTTP',httpStatus:error.status});return;
            }
            if(job.lastDeliveryCode!==(error.code||'RELAY_NETWORK')){
              job.lastDeliveryCode=error.code||'RELAY_NETWORK';this.trace('ResultRetry',{relayCallId:job.id,tool:job.tool,code:job.lastDeliveryCode});
            }
            await this.sleep(2000);
          }
        }
      }finally{job.sending=false;}
    }
    async stop(){
      const bindingId=this.bindingId;this.running=false;this.epoch++;this.bindingId=null;
      for(const controller of this.requests)controller.abort();
      for(const job of this.jobs.values())job.controller.abort();
      for(const wake of [...this.waiters])wake();
      this.jobs.clear();this.cacheBytes=0;this.report('off');
      if(bindingId)await this.request('unregister',{bindingId},3000).catch(()=>{});
    }
  }
  return {RelayClient,PROTOCOL,baseURL};
});
