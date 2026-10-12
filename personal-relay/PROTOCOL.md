# nyoru-relay/1

개인 중계기의 도구 제공자 계약입니다. HTTP MCP 클라이언트와 HTML/플러그인 제공자의 두 경계를 구분합니다. 참고한 공개 계약은 [MCP 2025-06-18 전송](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports), [생명주기](https://modelcontextprotocol.io/specification/2025-06-18/basic/lifecycle), [도구](https://modelcontextprotocol.io/specification/2025-06-18/server/tools)입니다.

## MCP 쪽

`/mcp` 또는 `/mcp/{publisherId}`로 POST JSON-RPC 2.0을 보냅니다. Consumer key를 Bearer로 전달합니다. initialize → notifications/initialized → tools/list 또는 tools/call 순서이며 응답의 `Mcp-Session-Id`를 이후 요청에 전달합니다. protocolVersion은 2025-06-18·2025-03-26·2024-11-05를 협상합니다. 클라이언트가 더 새 버전을 요청하면 지원 버전을 반환하여 수락 여부를 맡깁니다.

JSON 응답을 사용하는 Streamable HTTP입니다. GET 스트림은 405, DELETE는 해당 세션 종료입니다. requests batch, resource/prompt 서버, 자동 tools/list_changed는 구현하지 않습니다. `tools.listChanged`는 false입니다.

도구 이름은 `{publisherId}__{originalName}`입니다. 64자를 넘으면 앞부분과 해시로 줄입니다. 이름 충돌 시 묵시적으로 덮어쓰지 않습니다. `inputSchema`의 예약 필드 `_relayContext`에는 현재 bindingId 하나의 enum을 추가합니다. 실제 실행 시 검증하고 제거하여 원래 인자만 전달합니다. 클라이언트가 이전 세션의 목록을 보관했다면 새 세션에서도 유효한 현재 토큰으로 호출할 수 있습니다.

같은 세션의 동일 request id·본문은 같은 진행 작업/결과를 공유합니다. 같은 ID의 다른 본문은 거절합니다. 완료 요청도 세션 한도 256개에 포함합니다. 한도에 도달하면 새 행동 전에 연결을 초기화해야 합니다. 응답 캐시가 찼거나 결과가 너무 크면 실행 결과를 모르는 상태로 반환하며 행동을 자동 재실행하지 않습니다.

## 제공자 쪽

모든 경로는 `/bridge/v1/` 아래입니다. status만 Consumer key, 나머지는 Publisher key가 필요합니다. POST는 application/json이며 하나의 JSON object입니다.

| 경로 | 입력 | 응답 |
| --- | --- | --- |
| POST register | protocol, publisherId, instanceId, contextId, name?, tools | protocol, bindingId, leaseMs, endpoint |
| POST poll | bindingId | calls[], cancellations[] |
| POST result | bindingId, callId, result | ok, duplicate? |
| POST unregister | bindingId | ok |
| GET status | 없음 | version, activeCalls, publishers[] |

`publisherId`는 영문·숫자·_·- 1~32자입니다. `instanceId`는 실행 창의 고유 ID, `contextId`는 현재 문서/채팅 경계이며 이름이나 내용을 넣을 필요가 없습니다. `tools`는 MCP Tool 정의이며 object inputSchema를 요구합니다. 추가 필드 timeoutMs는 1000~3600000, 기본 600000입니다. `_relayContext`를 직접 정의하지 않습니다. 지원하지 않는 복잡한 JSON Schema를 모델 제공자가 제한할 수 있으므로 모델과의 스키마 호환은 별도 책임입니다.

동일 인스턴스·문맥·도구 목록의 재등록은 기존 binding을 유지합니다. 다른 문맥·목록이면 새 binding으로 바뀌며 이전 호출은 취소됩니다. 다른 살아 있는 인스턴스가 같은 그룹을 빼앗을 수 없습니다. 60초 동안 poll/result/register가 없으면 만료됩니다. poll은 한 번에 하나, 최대 15초 대기, 한 응답에 최대 4개 호출입니다.

호출 형태:

```json
{
  "id": "relay-call-id",
  "name": "read_state",
  "arguments": {},
  "contextId": "document-id",
  "timeoutMs": 30000
}
```

`result`는 `content` 배열과 선택 isError를 갖는 MCP CallToolResult입니다. SDK는 일반 반환값도 text 결과로 감싸지만 권장 형식은 명시적인 CallToolResult입니다. 같은 callId에 같은 결과를 다시 보내면 중복 확인으로 응답합니다. 서로 다른 결과를 보내면 거절합니다. 결과 재시도는 해당 작업의 함수를 다시 실행하는 요청이 아닙니다.

MCP 취소·도구 시간초과·binding 교체 시 해당 id를 cancellations에 전달합니다. SDK는 AbortSignal을 실행 함수에 전달합니다. 실제 취소·저장 직전 검증은 제공자가 구현해야 하며 완료된 저장을 중계기가 되돌리지 않습니다. HTTP 연결 해제만으로 완료된 행동이 취소되었다고 가정하지 않습니다.

## 데이터와 신뢰 경계

두 연결키는 중계기 전체를 신뢰하는 개인용 비밀입니다. Publisher key를 가진 프로그램은 도구를 게시하고, Consumer key를 가진 클라이언트는 게시된 도구를 호출할 수 있습니다. 사용자·도구별 ACL, OAuth, 인터넷 공개 테넌트는 없습니다. 도구 설명·인자·결과를 실행 코드로 평가하지 않습니다. 원래 함수가 인자 스키마·권한·현재 문맥·중복 저장을 검증해야 합니다.

Origin과 Host를 확인하고 기본적으로 loopback에만 listen합니다. 키를 URL에 싣지 않으며 HTML 연결 페이지는 서버 키를 자동 노출하지 않습니다. 실행 터미널에만 로컬 설정용 키를 출력합니다. 호출 원문·응답·헤더를 디스크 로그에 기록하지 않습니다.

## HTTPS 경로 프록시

`--public-url https://private.example/relay`를 쓰면 외부 주소는 `/relay/mcp` 등이 됩니다. 앞단 프록시는 `/relay` 접두사를 제거해서 이 서버의 `/mcp`, `/bridge/v1/*`, `/client.js`, 정적 경로로 전달해야 합니다. Authorization·Mcp-Session-Id·MCP-Protocol-Version 헤더를 보존하며 긴 도구 응답의 프록시 시간초과를 맞춥니다. 본 서버가 Risu 프록시 설정이나 인증서를 변경하지 않습니다.
