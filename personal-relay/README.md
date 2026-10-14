# Nyoru 개인 MCP 중계기 · AI 프록시 실험 1

**[AI 프록시 연결 방법 →](AI-PROXY.md)**

이번 실험판은 중계기가 메인 AI의 도구 호출을 직접 연결합니다. 기존 MCP 방식도 사용할 수 있습니다. 아래는 MCP 연결과 실행 환경 안내입니다.

내 컴퓨터에서만 관리하는 작은 중계기입니다. 브라우저·HTML·플러그인이 도구를 등록하고, Provider Manager가 HTTP MCP 주소로 호출합니다. 공용 서버·회원가입·유료 중계 서비스가 필요하지 않습니다.

```text
메인 AI / Provider Manager
  → HTTP MCP → 내 중계기 ← HTML / 플러그인
                          도구 등록·호출 수신·결과 반환
```

도구의 계산과 저장은 원래 HTML·플러그인에서 실행합니다. 중계기는 도구 목록·호출·결과를 전달합니다. HTML은 도구를 제공하는 클라이언트이며 HTTP 서버 자체는 Node.js 프로세스입니다.

이 ZIP에는 중계기, 연결 화면, 공통 SDK와 제작자 문서가 들어 있습니다. 사용할 플러그인은 각 제작자의 배포본을 별도로 설치합니다. 특정 RPG나 프로바이더 설치 파일은 포함하지 않습니다.

## Windows에서 시작

1. Node.js **20 이상**이 설치된 컴퓨터에서 ZIP을 별도 폴더에 풉니다. `npm install`은 필요하지 않습니다.
2. `start.cmd`를 실행합니다. 시작 파일은 곧 끝나고 **중계기 전용 실행창**이 열립니다. 주소와 연결키가 표시된 이 창을 켜 둡니다.
3. 실행창의 **연결 안내 페이지** 주소를 인터넷 브라우저 주소창에 복사해 엽니다. 기본은 `http://127.0.0.1:18765/`입니다.
4. 실행창에 **등록용 키 (Publisher key)**와 **호출용 키 (Consumer key)**가 각각 나옵니다. 등록용 키는 플러그인·HTML에, 호출용 키는 Provider Manager의 Bearer 인증값에 입력합니다.

검은 실행창을 **최소화하면 계속 실행**됩니다. 실행창의 **X를 누르거나 Ctrl+C를 누르면 중계기가 종료**됩니다. 브라우저의 연결 안내 페이지만 닫는 것은 중계기 실행에 영향을 주지 않습니다.

Windows 시작 파일은 서버를 연 뒤 종료합니다. 중계기 실행창만 켜 두세요.

키는 최초 실행 시 같은 폴더의 `data/connection.json`에 생성됩니다. 다시 실행하면 같은 키를 사용합니다. 이 파일은 개인 인증정보이므로 배포 ZIP·Git·게임 백업에 포함하지 않습니다. Node 실행 프로그램은 이 ZIP에 포함하지 않습니다.

업데이트할 때는 중계기를 종료하고 기존 중계기 폴더에 새 프로그램 파일을 덮어쓴 뒤 `start.cmd`를 다시 실행하세요. **기존 `data` 폴더와 `connection.json`은 그대로 보관**해야 연결키가 유지됩니다.

AI 프록시 패치는 `server.cjs`·`ai-proxy.cjs`·`ai-upstream.cjs`와 `web` 파일을 함께 교체합니다.

## 도구 연결하기

1. 중계기 연동을 지원하는 플러그인·HTML을 열고, 그 프로그램의 중계기 설정에 **기본 주소**와 **Publisher key**를 입력해 연결합니다. 기본 주소는 `http://127.0.0.1:18765`이며 `/mcp`를 붙이지 않습니다.
2. 중계기 첫 화면에서 **Consumer key**를 입력하고 **도구·주소 확인**을 누릅니다. 등록된 도구가 없다면 사용할 플러그인에서 먼저 연결해야 합니다.
3. 같은 화면의 **프로바이더에 등록**에서 사용할 도구 그룹을 고릅니다. **URL 복사**를 누르고 Provider Manager의 **MCP 서버 추가**에 표시된 값을 넣습니다.

| 항목 | 값 |
| --- | --- |
| 이름 | 알아보기 쉬운 도구 이름 |
| URL | 연결 화면에서 선택한 그룹의 URL |
| Transport | `streamable-http` |
| Timeout ms | `600000` · 생성 대기에 맞춰 조정 가능 |
| Auth | `Bearer` |
| 인증값 | 실행창의 **Consumer key 값만** 붙여넣기 |

4. 도구 목록을 불러오고 사용할 모델에서 해당 그룹을 켭니다. 동일한 도구가 다른 경로로도 등록되어 있다면 사용할 경로 하나만 켭니다.

첫 화면의 Consumer key 입력으로 **등록된 도구와 실제 MCP 주소를 확인**합니다. 별도의 예제 페이지를 열 필요가 없습니다. 여러 그룹을 한 번에 사용하려면 **등록된 모든 도구를 하나의 주소로 연결하기**를 펼쳐 전체 URL을 복사합니다.

`//@allowed-ipc`나 프로바이더 파일을 수정하지 않습니다. 네트워크 권한 요청이 나타나면 자신의 중계기 주소인지 확인하고 허용합니다. 등록 성공은 중계기가 도구를 받았다는 뜻이며, 모델이 실제로 사용했다는 뜻은 아닙니다.

플러그인이 사용하는 문서·채팅이나 도구 구성이 바뀌면 Provider Manager의 도구 목록을 다시 불러오세요. 이전 문맥의 스키마로 새 문맥에 행동을 보내면 거절됩니다. 이 버전은 자동 목록 변경 알림을 제공하지 않습니다.

## 개인 Risu 서버와 함께 사용

기존 서버와 중계기는 **폴더·프로세스·포트가 별개**입니다. NodeRisu·해적리스·포켓리스의 설치 폴더, 설정, 저장 DB, 실행 명령을 바꾸지 않습니다. 기본 포트 `18765`가 사용 중이면 중계기는 시작을 중단하며 기존 프로그램을 종료하지 않습니다.

다른 포트로 시작하려면 중계기 폴더에서:

```powershell
node server.cjs --port 18766
```

이때 연결한 플러그인의 기본 주소와 Provider Manager의 URL도 `18766`으로 맞춥니다. 서로 다른 포트라면 한 PC에 여러 서버를 켤 수 있지만 RAM·CPU·네트워크 자원은 공유합니다. 실제 기기별 부하는 측정하지 않았습니다.

Risu가 PC에서 실행되어도 사용자가 휴대폰 브라우저로 접속했다면, 플러그인 요청이 어느 기기에서 나가는지는 해당 Risu·프로바이더의 전송 방식에 따릅니다. **휴대폰의 127.0.0.1은 PC가 아닙니다.** Risu에 접속되는 기존 터널이 중계기 포트까지 자동으로 연결해 주지도 않습니다.

## 다른 HTML·도구 연결

플러그인 제작자는 [제작자용 연결 안내](DEVELOPER_GUIDE.md)를 읽으세요. 주소·키 입력창, 확인·해제 버튼, 도구 스키마, 기존 함수 연결, 기기별 키 저장, 문맥 변경 처리까지 설명합니다. `web/example.html`과 `web/example.js`는 제작자가 코드를 참고하기 위한 덧셈 도구 예제입니다. 일반 사용자의 연결 과정에는 사용하지 않습니다.

개발자는 `client.js`를 자기 프로젝트에 포함하고 다음 세 부분을 연결합니다.

```js
const client = new NyoruMcpRelay.RelayClient({
  url: 'http://127.0.0.1:18765',
  key: publisherKey,             // 사용자에게 입력받기; 코드에 배포하지 않기
  publisherId: 'myTool',         // 다른 그룹과 겹치지 않는 이름
  contextId: currentDocumentId,  // 현재 채팅·문서의 경계
  tools: [{
    name: 'read_state',
    description: 'Read the current document state.',
    inputSchema: {type: 'object', properties: {}, additionalProperties: false},
    timeoutMs: 30000
  }],
  async handleCall(name, args, {signal, callId, contextId}) {
    if (signal.aborted) throw new Error('Cancelled');
    // 현재 문서·권한·입력과 저장 직전 취소를 도구 쪽에서도 확인합니다.
    const data = await readMyDocument(contextId, {signal});
    return {content: [{type: 'text', text: JSON.stringify(data)}]};
  }
});
await client.start();
// 문서가 바뀌면 먼저 await client.stop() 후 새 contextId로 등록합니다.
```

브라우저는 `<script src="client.js"></script>`, Node는 `require('./client.js')`로 사용합니다. Node에서도 `RelayClient`는 내장 fetch를 쓰므로 20 이상을 사용합니다. 사용자 호출을 자동으로 실행하는 것은 등록한 `handleCall`입니다. 자신이 소유한 API·함수의 허용된 작업만 연결하세요.

단일 도구 그룹 URL은 `/mcp/myTool`, 모든 연결 도구 URL은 `/mcp`입니다. 두 URL을 같은 모델에 동시에 켜면 같은 도구가 중복 노출되므로 하나를 선택합니다. 이미 HTTP MCP 주소가 있는 도구는 직접 연결할 수 있습니다. 기존 stdio MCP 실행파일이나 다른 플러그인을 수정 없이 자동으로 발견하는 기능은 이번 버전에 없습니다. 기존 도구도 이 클라이언트 규격에 연결하는 어댑터가 필요합니다.

HTML 페이지가 닫히거나 모바일 브라우저가 절전하면 등록이 끊깁니다. 실행 HTML에 게임 저장 전체·프로바이더 API 키를 전달할 필요는 없습니다. 등록된 함수가 필요한 데이터만 다루도록 설계합니다.

## Linux·개인 서버·Android

Node.js가 있는 환경에서 `sh start.sh` 또는 `node server.cjs`로 실행합니다. Android는 Termux 등 Node 실행 환경이 별도로 필요합니다. APK나 자동 시작 서비스는 포함하지 않습니다.

같은 사설 네트워크의 휴대폰에서 PC 중계기에 접근하려면 명시적으로 다른 기기 접속을 열 수 있습니다.

```powershell
node server.cjs --host 0.0.0.0 --public-url http://192.168.0.10:18765 --allow-origin http://192.168.0.10:6001
```

위 주소는 예시입니다. PC의 실제 IP와 **브라우저 주소창의 Risu 출처(origin)**로 바꿉니다. OS 방화벽 허용이 필요할 수 있으며 이 프로그램이 방화벽을 자동 변경하지 않습니다. 연결 설정의 기본 주소와 MCP URL도 PC 주소를 사용합니다.

HTTPS 웹 Risu에서 HTTP 사설 IP로 직접 요청하면 브라우저의 혼합 콘텐츠·사설 네트워크 권한 정책에 막힐 수 있습니다. CORS 허용만으로 모든 환경을 해결하지는 못합니다. 이 경우 가능한 호스트 전송을 선택하거나, 자신이 운영하는 HTTPS 리버스 프록시/사설망을 사용합니다. Risu와 중계기를 같은 프록시에서 쓰더라도 중계기 경로를 별도로 연결해야 합니다. 도메인이 다르면 `--allow-origin https://your-risu.example`로 정확한 출처를 추가합니다.

기본 허용 출처는 localhost·127.0.0.1·::1의 HTTP(S), risuai.xyz·risuai.dev, 파일/샌드박스의 null origin입니다. 모든 API에는 역할별 연결키가 필요합니다. 외부 인터넷 공개용 OAuth·다중 사용자 권한 분리는 제공하지 않습니다.

### 선택 사항: Docker

배포 폴더의 `docker-compose.yml`로 실행할 수도 있습니다. 기본 포트는 호스트의 `127.0.0.1`에만 연결하고 키 파일은 중계기 전용 볼륨에 보관합니다. Risu 컨테이너·저장 볼륨을 사용하지 않습니다. 포트 충돌 시 compose의 왼쪽 호스트 포트만 바꾸고 플러그인·프로바이더 주소도 맞춥니다.

```sh
docker compose up -d --build
docker compose logs relay
```

개인 키가 실행 로그에 표시됩니다. 로그 전체를 공개하지 마세요. 다른 기기 접속과 HTTPS 설정은 별도로 해야 합니다.

## 실패했을 때

| 표시 | 확인할 것 |
| --- | --- |
| Port already in use | 다른 포트로 중계기만 실행 |
| AUTH | 플러그인/HTML에는 Publisher key, PM에는 Consumer key |
| ORIGIN / HOST | 실제 접속 주소와 허용 출처·public-url |
| PUBLISHER_BUSY | 같은 그룹을 사용 중인 다른 탭 종료 또는 그룹 이름 변경. 끊긴 창의 임대 만료는 최대 60초 |
| TOOL_OFFLINE / CONTEXT_CHANGED | 현재 채팅 전원 확인 후 PM에서 도구 목록 다시 읽기 |
| SESSION_EXPIRED | MCP 연결을 다시 초기화. 이전 행동은 바로 반복하지 않기 |
| OUTCOME_UNCONFIRMED | 원래 도구의 기록으로 실제 반영 여부를 먼저 확인 |

한 호출의 응답이 유실되면 SDK는 **저장된 응답만** 다시 전송합니다. 이미 전달한 행동 자체는 중계기가 재배달하지 않습니다. 세션의 동일 요청 ID는 같은 결과를 재사용하지만, 재시작·새 요청 ID까지 포괄하는 영구적인 중복 방지는 아닙니다. 금전·게임 행동 같은 변경은 원래 도구의 actionId/영수증을 함께 사용해야 합니다.

호출·응답은 메모리에 제한적으로 보관하고 디스크에는 기록하지 않습니다. 중계기를 재시작하면 이 연결·중복 확인 기록이 사라지며 원래 플러그인에 저장된 상태는 유지됩니다. 중계기 한도는 본문 2 MiB, 그룹 16개, 그룹당 도구 64개, MCP 세션 16개, 진행 중 호출 64개, 세션당 요청 256개, 응답 캐시 총 16 MiB입니다. SDK의 완료 호출 캐시는 최근 256개이며 활성 요청을 재실행하기 위해 제거하지 않습니다.

## 구현·확인 범위

범용 HTTP 중계기, 연결 화면, 공통 SDK, 제작자용 코드 예제, Windows/Linux 실행 스크립트를 포함합니다. MCP Streamable HTTP JSON 응답과 세션·목록·호출·취소를 구현하고 독립 SSE 전송은 제공하지 않습니다. [연결 규격](PROTOCOL.md)에 세부 계약을 남깁니다.

이번 작업은 **소스 작성과 배포 파일 생성** 범위입니다. 추가 자동 테스트·브라우저·모의 호스트·실제 Risu·모바일·유료 API 검사는 실행하지 않았습니다. 해적리스 b7085·포켓리스·NodeRisu·Provider Manager의 실환경 연결 성공이나 모바일 백그라운드 유지를 보장하지 않습니다. GitHub에는 올리지 않습니다.
