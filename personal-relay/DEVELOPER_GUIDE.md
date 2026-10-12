# 플러그인 제작자를 위한 개인 MCP 중계기 연결 안내

이 문서는 **내 플러그인의 기능을 메인 AI가 호출하게 만들려는 제작자**를 위한 안내입니다. 중계기 0.1.0의 공통 클라이언트 규격을 기준으로 작성했습니다. 특정 RPG나 프로바이더에 의존하지 않습니다.

제작자가 추가할 것은 **설정 입력창 → 연결 버튼 → 도구 목록 → 기존 함수 연결 → 종료/채팅 변경 처리**입니다. 중계기의 HTTP 서버나 프로바이더의 IPC를 다시 구현할 필요는 없습니다. 사용자는 개인 중계기 하나를 실행하고 여러 플러그인을 서로 다른 그룹 이름으로 등록할 수 있습니다.

먼저 [일반 사용자 설치 안내](README.md)를 읽고 배포 ZIP을 풉니다. 이 문서와 함께 제공하는 파일은 다음과 같습니다.

| 파일 | 용도 |
| --- | --- |
| `client.js` | 제작자의 플러그인에 포함할 공통 연결 코드 |
| `web/example.html` | 주소·키 입력창, 확인·해제 버튼, 상태 표시가 있는 예제 |
| `web/example.js` | 버튼 이벤트와 도구 함수 연결 예제 |
| `web/client.js` | HTML 파일을 직접 열 수 있도록 함께 복사한 동일 SDK |
| `PROTOCOL.md` | SDK 없이 직접 연결할 때 참고할 HTTP 계약 |

예제는 숫자 두 개를 더하는 읽기 전용 도구이며, 제작자의 코드 참고용입니다. **사용자가 기존 플러그인을 연결할 때 여는 화면이 아닙니다.** 사용자의 도구 확인·MCP 주소 복사는 중계기 첫 화면에서 처리합니다. 이번 배포에서 실환경 실행 시험을 수행한 예제는 아니며, 각 플러그인의 호스트·전송·저장 경계는 제작자가 확인해야 합니다.

## 1. 설정 화면에 입력창과 버튼을 배치합니다

처음에는 아래 정도면 충분합니다.

```text
개인 MCP 중계기

주소       [ http://127.0.0.1:18765               ]
등록용 키  [ ••••••••••••••••••••                 ]

[ 연결 확인·도구 등록 ]  [ 연결 해제 ]

상태: 아직 연결하지 않았습니다.
Provider Manager 주소: 연결 후 표시
```

| UI 항목 | 구현 방법 | 입력/클릭 시 동작 |
| --- | --- | --- |
| 중계기 주소 | `input type="url"`, 기본값 `http://127.0.0.1:18765` | 서버의 **기본 주소**를 받음. `/mcp`나 키는 붙이지 않음 |
| 등록용 키 | `input type="password"`, `autocomplete="off"` | 중계기의 **Publisher key**를 받음 |
| 연결 확인·도구 등록 | `button type="submit"` | 입력을 확인하고 `RelayClient.start()` 실행 |
| 연결 해제 | `button type="button"` | `RelayClient.stop()` 실행 |
| 연결 상태 | `role="status"` | 연결 중·등록 완료·재연결·실패를 구분 |
| PM용 주소 | 읽기 전용 입력창 | 등록 후 `client.endpoint`를 표시하여 복사 가능하게 함 |

`publisherId`는 도구 그룹의 고유 이름입니다. 일반 사용자에게 매번 입력하게 하기보다 제작자가 `myInventoryPlugin`처럼 정해 두면 됩니다. 예제에서는 개발 중 바꿔볼 수 있도록 입력창으로 노출했습니다. 다른 플러그인과 이름이 겹치지 않게 정하며 영문·숫자·밑줄·하이픈 1~32자만 사용합니다.

**등록용 키는 LLM API 키가 아닙니다.** 중계기 실행창의 Publisher key입니다. Consumer key는 사용자가 Provider Manager에 넣는 호출용 키이므로 제작자의 플러그인에서 요구할 필요가 없습니다.

최소 HTML은 다음과 같습니다. 전체 레이아웃과 연결 중 입력 잠금은 `web/example.html`과 `web/example.js`를 함께 참고하세요.

```html
<form id="connect-form">
  <label for="relay-url">개인 중계기 주소</label>
  <input id="relay-url" type="url" value="http://127.0.0.1:18765" required>

  <label for="publisher-key">등록용 키 · Publisher key</label>
  <input id="publisher-key" type="password" autocomplete="off" required>

  <button type="submit">연결 확인·도구 등록</button>
  <button id="disconnect" type="button">연결 해제</button>
</form>
<p id="status" role="status">아직 연결하지 않았습니다.</p>
<input id="endpoint" readonly aria-label="Provider Manager용 MCP URL">
```

## 2. client.js를 배포물에 포함합니다

일반 HTML이라면 HTML과 같은 폴더에 SDK를 두고 먼저 읽습니다.

```html
<script src="client.js" defer></script>
<script src="my-plugin.js" defer></script>
```

사용할 생성자는 `NyoruMcpRelay.RelayClient`입니다. CommonJS를 처리하는 번들러나 Node에서는 아래처럼 가져옵니다.

```js
const {RelayClient} = require('./client.js');
```

Risu에 플러그인 JS 한 파일로 배포한다면 **빌드 때 SDK를 함께 묶습니다.** 브라우저의 Risu 플러그인에서 Node의 `require`를 그대로 쓸 수 있다는 뜻은 아닙니다. 자신의 번들러가 CommonJS를 처리하도록 하거나, SDK 소스를 같은 배포 스크립트에 포함해 전역 API를 사용합니다. 런타임에 사용자의 중계기에서 임의 스크립트를 받아 `eval`하는 방식은 필요하지 않습니다.

## 3. AI에게 보여 줄 도구를 정의합니다

`tools`에는 도구의 이름, 설명, 인자의 JSON Schema를 적습니다. 처음에는 조회 기능 하나만 연결하면 문제를 구분하기 쉽습니다.

```js
const tools = [{
  name: 'add_numbers',
  description: 'Add two finite numbers in the connected HTML page.',
  inputSchema: {
    type: 'object',
    properties: {
      a: {type: 'number'},
      b: {type: 'number'}
    },
    required: ['a', 'b'],
    additionalProperties: false
  },
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  },
  timeoutMs: 10000
}];
```

제작자가 `name`을 `read_inventory`로 바꾼다면 설명과 입력 형식도 실제 인벤토리 조회에 맞춥니다. 설명에는 대상·할 수 있는 일·결과를 적고, 지원하지 않는 편집이나 저장을 할 수 있다고 쓰지 않습니다. 영어 설명은 예시이며 필수 규칙은 아닙니다.

`annotations`는 클라이언트에 주는 힌트입니다. `readOnlyHint: true`라고 적었다고 함수가 읽기 전용으로 강제되는 것은 아닙니다. 데이터 변경 도구를 조회 도구로 표시하면 안 됩니다. `timeoutMs`는 1,000~3,600,000 범위이며 Provider Manager의 대기시간도 작업에 맞춰야 합니다.

`_relayContext`는 중계기가 추가하는 예약 인자입니다. 자신의 스키마에 넣거나 호출 처리 함수에서 직접 요구하지 않습니다. 중계기가 먼저 검증한 뒤 제거하여 원래 인자만 전달합니다.

## 4. handleCall에서 기존 기능을 호출합니다

도구 정의는 AI에게 보이는 설명이고, 실제 실행은 `handleCall`이 담당합니다.

```js
async function handleCall(name, args, {signal, callId, contextId}) {
  if (signal.aborted) {
    return {isError: true, content: [{type: 'text', text: '실행 전에 취소되었습니다.'}]};
  }
  if (name !== 'add_numbers') {
    return {isError: true, content: [{type: 'text', text: '등록되지 않은 도구입니다.'}]};
  }
  if (!Number.isFinite(args?.a) || !Number.isFinite(args?.b) ||
      !Number.isFinite(args.a + args.b) ||
      Object.keys(args).some(key => !['a', 'b'].includes(key))) {
    return {isError: true, content: [{type: 'text', text: '유한한 숫자 a, b가 필요합니다.'}]};
  }
  const sum = args.a + args.b;
  return {content: [{type: 'text', text: JSON.stringify({sum})}]};
}
```

자신의 플러그인에서는 이 계산 자리를 **원래 조회·편집·계산 함수**로 연결합니다. HTTP 연결을 만들었다는 이유로 저장 로직을 새로 복제하거나 기존 권한·채팅·전투·버전 충돌 검사를 생략하지 않습니다. JSON Schema만 믿지 말고 처리 함수에서도 도구 이름·타입·범위·대상을 확인합니다.

`content`는 모델에게 돌아갈 결과이고 `isError: true`는 도구 처리 실패입니다. 성공에는 필요한 결과만 넣습니다. 인증키, 내부 전체 설정, 불필요한 전체 채팅을 결과에 실을 필요가 없습니다.

## 5. 확인 버튼에 연결·등록을 붙입니다

개념상 버튼은 다음 순서로 동작합니다.

```text
입력 확인 → 버튼 중복 클릭 차단 → 현재 문맥 확보
→ RelayClient 생성 → await client.start()
→ '중계기 등록 완료' 표시 → client.endpoint 표시
```

연결 객체를 만드는 부분은 다음과 같습니다. **아래 `currentContextId`와 상태 표시 함수는 자신의 플러그인에서 제공하는 값/함수입니다.** 전체 버튼 코드가 필요한 경우 이미 작성된 `web/example.js`를 사용하세요.

```js
const client = new NyoruMcpRelay.RelayClient({
  url: addressInput.value.trim(),
  key: publisherKeyInput.value.trim(),
  publisherId: 'myPlugin',
  name: '내 플러그인',
  contextId: currentContextId,
  tools,
  handleCall,
  onStatus({state, code}) {
    // state: connecting / connected / reconnecting / off / error
    showConnectionStatus(state, code);
  }
});

await client.start();
showMcpUrl(client.endpoint);
```

`start()`는 인증·도구 등록을 요청하고 호출 수신을 시작합니다. **단순 ping만 하는 검사가 아닙니다.** 따라서 버튼 이름도 `연결 확인·도구 등록`으로 적었습니다. 이 버튼을 눌렀다고 LLM API를 호출하거나 자신의 게임 행동 함수를 실행하지 않습니다. 등록된 도구를 소비자가 호출할 때 `handleCall`이 실행됩니다.

등록 응답을 받았을 때 적절한 문구는 다음과 같습니다.

> 중계기에 도구를 등록했습니다. Provider Manager에서 목록을 읽고 이 그룹을 켜 주세요.

이 단계에서 `AI 연결 완료`, `모든 기능 정상`, `실제 호출 성공`이라고 표시하지 않습니다. 연결 상태와 **실제 도구 호출 수신 시각·이름**은 따로 표시하세요. 예제의 계산 결과도 handleCall이 호출되었을 때만 바뀝니다. 그 결과가 모델까지 전달되어 사용됐는지는 소비자 쪽 확인이 필요합니다.

연결 중에는 중복 제출을 막습니다. 실패하면 입력을 유지해 고칠 수 있게 하고 코드에 맞는 오류를 보여 줍니다. 새 연결 시도가 시작되거나 창이 닫힌 후 도착한 옛 응답이 새 UI 상태를 덮어쓰지 않도록 실행 번호나 현재 연결 객체를 비교합니다. 예제의 `generation`이 이 역할을 합니다.

## 6. 저장 버튼을 별도로 둘 경우

제공된 HTML 예제는 키를 디스크에 저장하지 않습니다. 플러그인 설정을 기억하려면 아래 두 종류를 분리합니다.

| 저장 대상 | 위치와 처리 |
| --- | --- |
| 주소·그룹 이름·사용 여부 | 자신의 설정 저장소. 저장에 성공한 후에만 저장 완료 표시 |
| 등록용 키 | 기기별 비밀 저장소에 플러그인 전용 키로 저장하고 **중계기 주소와 함께 묶기** |

주소가 바뀌면 이전 주소의 키를 새 서버에 자동 전송하지 않습니다. `저장`은 설정 저장만 하고, `연결 확인·등록`은 실제 등록을 요청하도록 분리할 수 있습니다. 하나로 합치려면 `저장하고 연결`로 이름을 정하고 **저장은 됐지만 연결은 실패한 상태**도 구분해 보여 주세요.

호스트가 기기별 인증정보 저장 API를 제공하면 그 저장소를 사용합니다. 해당 API가 없는 환경에서는 현재 실행 동안만 키를 보관한다고 안내합니다. 사용자 데이터 백업·동기화된 전체 설정에 키를 섞거나, 다른 플러그인과 공유하는 저장소 전체를 clear하지 않습니다.

사용 토글을 추가한다면 OFF에서 **자동 등록·폴링·재연결을 시작하지 않게** 합니다. 이미 켜진 연결은 stop합니다. 단순히 상태 글자만 OFF로 바꾸지 않습니다.

## 7. Provider Manager에 복사할 정보를 보여 줍니다

그룹 이름이 `myPlugin`이라면 연결 후 다음 정보를 표시하면 됩니다.

```text
URL:       http://127.0.0.1:18765/mcp/myPlugin
Transport: streamable-http
Auth:      Bearer
인증값:    중계기 실행창의 Consumer key
Timeout ms: 600000
```

주소는 문자열을 별도로 추측해서 조립하기보다 **등록에 사용한 client.endpoint**를 표시합니다. Consumer key를 화면에서 자동으로 불러올 필요는 없습니다. 사용자가 자신의 중계기 실행창에서 PM에 넣습니다. AI에는 `myPlugin__add_numbers` 형태로 도구가 노출되며 프로바이더가 추가 접두사를 붙일 수도 있습니다.

사용자 안내는 **플러그인에 기본 주소·Publisher key 입력 → 중계기 안내 페이지에 Consumer key를 넣어 등록된 그룹·전용 URL 확인 → 프로바이더에 URL·Transport·Auth·인증값·Timeout 입력** 순서로 작성합니다. Consumer key로 조회하는 단계는 새 주소 발급이 아니라 이미 등록된 도구 확인입니다. 전체 주소 `/mcp`는 여러 그룹을 함께 연결하려는 사용자를 위한 선택 안내로 둡니다.

여러 제작자의 플러그인이 같은 중계기를 사용해도 그룹 이름만 각각 다르게 정하면 됩니다. 제작자마다 기본 포트에 새 서버를 하나씩 띄우지 않습니다. 전체 그룹 URL `/mcp`를 쓰는 경우 같은 그룹의 전용 URL을 중복으로 켜지 않도록 안내합니다.

## 8. 종료·채팅 변경에 연결 해제를 붙입니다

`contextId`는 현재 채팅·문서·프로젝트를 구분하는 불투명한 문자열입니다. 실제 본문을 넣지 않습니다. 새 채팅인데 이전 ID를 계속 쓰면 중계기가 구분할 수 없습니다.

```text
채팅/문서 변경 감지
→ 기존 연결의 await client.stop()
→ 새 문맥과 도구 목록 확인
→ 사용 ON인 경우 새 contextId로 RelayClient 생성·start
→ 사용자에게 PM 도구 목록 갱신 안내
```

등록 시 고정한 문맥과 **실제 실행 직전 현재 문맥**이 같은지 제공자 함수에서도 확인합니다. 오래 걸리는 작업이라면 `await`를 지난 뒤, 특히 저장하기 직전에 다시 검사합니다. 중계기 토큰만으로 플러그인 내부 문서 변경까지 자동 감지되는 것은 아닙니다.

플러그인 unload, 사용자 연결 OFF, 도구 사용 권한 철회에도 stop을 호출합니다. 설정 패널을 닫는 것이 플러그인 종료와 같은 것은 아닙니다. 평소에는 패널이 닫혀도 연결을 유지하고, 앱/플러그인 생명주기에 연결 객체를 보관할 수 있습니다. 예제 HTML은 페이지 자체가 제공자이므로 pagehide에서 해제합니다.

이번 버전은 서버가 `tools/list_changed` 알림을 보내지 않습니다. 문맥이나 도구 구성이 바뀌면 Provider Manager에서 목록을 다시 읽어야 합니다. 이 단계를 빠뜨렸을 때 억지로 예전 토큰을 허용하지 않습니다.

## 9. Risu 플러그인의 전송 방식

기본 SDK는 브라우저 fetch를 사용합니다. Risu 플러그인에서 호스트 전송을 쓰려면 SDK의 `fetch` 옵션에 자신의 API 래퍼를 전달합니다. 현재 RPG 구현은 아래 형태입니다. `api`는 자신의 플러그인에서 받은 Risu API 객체입니다.

```js
const relayFetch = (url, options) => {
  const {signal, ...wireOptions} = options;
  return api.nativeFetch(url, {
    ...wireOptions,
    requestTimeoutMs: 26000
  });
};

// RelayClient 옵션에 추가:
// fetch: relayFetch
```

일부 플러그인 RPC는 AbortSignal을 직렬화할 수 없어 래퍼에서 제외합니다. SDK가 기다리기를 중단하는 것과 호스트의 실제 네트워크 요청이 중단되는 것은 다를 수 있습니다. 도구 함수에 전달되는 signal과 저장 직전 검사는 계속 유지합니다.

호스트 전송의 API·네트워크 권한은 해당 버전에서 지원되어야 합니다. 직접 fetch는 CORS·HTTPS 혼합 콘텐츠·사설 네트워크 정책을 따릅니다. 모바일의 localhost는 모바일 자신이며 PC 서버가 아닙니다. 서버판 Risu라고 플러그인의 모든 요청이 서버 PC에서 나간다고 가정하지 않습니다. [주소·LAN·HTTPS 안내](README.md#linux개인-서버android)를 함께 제공하세요.

## 10. 데이터를 변경하는 도구로 확장할 때

중계기는 전송을 담당합니다. 저장의 단 한 번 적용은 원래 도구가 보장해야 합니다.

```text
입력 타입/범위/권한/현재 문맥 확인
→ 플러그인의 기존 직렬 처리 또는 저장 트랜잭션 진입
→ actionId의 이전 영수증 확인
→ 이미 처리했다면 그 결과 반환
→ 취소·문맥을 다시 확인
→ 데이터 변경과 영수증을 같은 저장으로 반영
→ 저장된 결과 반환
```

위 흐름은 저장 설계 설명이며 복사 실행하는 API 코드는 아닙니다. 자신의 저장소가 원자적 트랜잭션을 지원하지 않는다면 해당 플러그인의 복구·버전 확인 방식까지 함께 설계합니다. `readOnlyHint`만 false로 바꾸면 중복 방지가 생기는 것은 아닙니다.

SDK의 `callId`는 전송 호출 ID입니다. 서버 재시작·새 MCP 세션·모델이 새 요청 ID로 재요청한 경우까지 같은 업무 행동을 식별하지는 못합니다. 재시작을 넘어 보존해야 하는 변경은 `actionId` 같은 업무 ID와 저장된 영수증을 사용합니다. SDK는 결과 전송을 재시도하며 변경 함수를 재실행하지 않습니다. 결과가 불명확하면 실제 저장 상태를 먼저 읽도록 응답합니다.

## 11. 오류를 사용자가 고칠 수 있는 문장으로 표시합니다

| 코드/상태 | 안내 예 |
| --- | --- |
| AUTH | 등록용 Publisher key를 확인해 주세요. |
| RELAY_URL / RELAY_ID | 기본 주소와 도구 그룹 이름을 확인해 주세요. |
| PUBLISHER_BUSY | 같은 그룹을 사용하는 다른 창을 닫거나 그룹 이름을 변경해 주세요. 끊긴 창은 최대 60초 후 만료됩니다. |
| ORIGIN / HOST | 중계기의 허용 출처와 접속 주소를 확인해 주세요. |
| TOOL_OFFLINE / CONTEXT_CHANGED | 현재 채팅으로 연결하고 PM의 도구 목록을 다시 읽어 주세요. |
| OUTCOME_UNCONFIRMED | 반영 여부를 원래 도구에서 먼저 확인해 주세요. 같은 변경을 자동 반복하지 않습니다. |
| 네트워크 실패 | 중계기 실행 여부와 주소·전송 방식·방화벽을 확인해 주세요. |

개발 진단은 단계, 오류 코드, 도구 이름, 소요시간 정도로 남기면 연결 문제를 구분하기 쉽습니다. 키·Authorization·질문 원문·도구 결과 전체를 기본 로그에 쓰지 않습니다. 성공 기록도 `등록 완료`, `호출 수신`, `처리 완료`를 구분하고 모델이 사용했는지 모르면 그 상태를 유지합니다.

## 12. 제작자가 직접 확인할 순서

1. 중계기를 켜고 ZIP의 `web/example.html`을 엽니다. 주소·Publisher key를 넣고 확인 버튼을 누릅니다.
2. `중계기 등록 완료`와 복사할 MCP URL이 나오는지 확인합니다. 이 단계에서는 계산 결과가 바뀌지 않아야 합니다.
3. Provider Manager에 URL·Consumer key를 넣고 목록을 읽습니다. `add_numbers` 도구를 켭니다.
4. 호출하면 숫자 결과가 바뀌는지, 실제 결과가 소비자에게 전달되는지 각각 확인합니다. 모델을 통해 요청하면 그 모델의 사용료는 별도입니다.
5. 잘못된 키·서버 종료·중복 그룹·연결 해제·채팅 변경을 각각 확인합니다. 이전 채팅으로 변경이 들어가지 않아야 합니다.
6. 그다음 자신의 실제 도구를 연결하고 입력 검증·취소·중복 저장 경계를 확인합니다.

이 순서는 제작자에게 제공하는 확인 방법이며 **이번 문서 작성 과정에서 실행한 테스트 결과가 아닙니다.** 이 문서와 예제는 소스 작성·배포에 포함했고 실제 Risu/모바일/유료 모델 호출 검사는 수행하지 않았습니다. 실험판의 한도와 원시 API 계약은 [PROTOCOL.md](PROTOCOL.md)를 참고하세요.
