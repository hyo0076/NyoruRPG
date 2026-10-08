# NyoruRPG MCP 구조 · 0.30.1

## 0.30.1 독립 PDF 전송

main-context-pdf의 config는 기존 enabled/keepRecent에 mode(yumi/standalone), format(gemini/openai)를 추가한다. 누락 mode는 yumi로 읽는다. selection은 기존 일반 대화 선택 규칙을 공유한다. beforeRequest는 원문과 기존 RPG 상태 주입을 유지하며 standalone일 때 main-context-pdf-native에 범위·현재 상태 앵커·보호할 최근 블록만 준비한다.

main-context-pdf-native는 Risu API 3의 registerBodyIntercepter를 기존 replacer 권한으로 등록한다. 등록 불가 시 플러그인 전체 로딩은 유지하고 설정 화면에서 안내한다. gemini_base/gemini_base_stream/gemini_tool 또는 사용자가 선택한 openai_basic/openai_streaming/openai_tool만 편집한다. OpenAI 형식은 Gemini 모델 ID만 대상이다. 메타 응답 훅·다른 프로바이더 플러그인·보조 API는 편집하지 않는다.

실제 요청의 RPG 상태 앵커·현재 채팅·전원·설정을 확인하고 원문 메시지와 정확히 일치하는 구간을 찾는다. Risu의 같은 역할 병합은 줄바꿈 1개/2개 또는 개별 메시지와 정확히 비교한다. 중복 일치·최근 블록 경계 불명·다른 필드·도구 파트가 있는 메시지는 추정하지 않는다. PDF 생성이 모두 끝난 뒤 복제한 contents/messages만 교체하며 원래 body는 수정하지 않는다. 나머지 요청 옵션·도구 정의·도구 응답·서명과 스트리밍 처리는 호스트에 남긴다. 훅 오류나 지원하지 않는 요청에서는 원문을 그대로 반환한다.

text-pdf는 사용자 소유 NyoruMemory의 네이티브 Unicode 텍스트 PDF 방식을 독립 모듈로 옮긴 것이다. 외부 폰트·이미지·AI·업로드 API 없이 Type0/CID 및 ToUnicode를 작성하며 가능한 환경에서는 deflate한다. 읽기용 출력물이 아닌 Gemini의 내장 텍스트 추출용 전송 문서다. 1,000쪽·전체 인라인 JSON 20MB 상한을 적용한다. SHA-256(scope+원문)의 PDF만 메모리 LRU 16개·16MiB에 보관한다. 다음 도구 요청의 같은 구간을 재사용하고 원문 변경은 다시 만든다. 설정·채팅 변경·종료는 계획/캐시를 정리한다.

진단 mainContextPdfPrepared는 생성/첨부 준비 여부와 원문 분량·쪽수·바이트·재사용을 기록한다. 준비 시각은 preparedAt으로 분리하여 공통 호스트 진단의 숫자 at을 덮어쓰지 않는다. deliveryConfirmed:false와 usage:null은 서버 수신·청구를 확인한 것이 아님을 명시한다. [사용 설정](nyoru-release-0.30.1.md).

참고: [Risu 공식 요청 본문 훅](https://github.com/kwaroran/Risuai/blob/main/src/ts/plugins/apiV3/v3.svelte.ts), [Gemini 요청과 도구 후속 요청](https://github.com/kwaroran/Risuai/blob/main/src/ts/process/request/google.ts), [OpenAI 호환 전송](https://github.com/kwaroran/Risuai/blob/main/src/ts/process/request/openAI/requests.ts), [LLMGateway 문서 형식](https://docs.llmgateway.io/features/documents).

## 0.30.0 후속 · 과거 대화 PDF와 유미 전송 경계

main-context-pdf는 beforeRequest의 기존 상태 주입이 끝난 뒤 적용한다. safeMessage로 일반 대화만 분리하고 최근 블록을 제외한 긴 연속 구간의 앞뒤에 독립적인 pm-pdf 경계 메시지를 삽입한다. 원래 메시지·역할·서명은 수정하지 않는다. 자신의 경계만 재준비 시 제거하며 다른 프리셋의 구간 지정이 있으면 추가하지 않는다. power/module/type의 기존 게이트를 유지한다.

settings.mainContextPdf(enabled/keepRecent)는 기본 OFF/4이며 main-context-pdf-ui가 AI 연결에서 즉시 저장한다. PDF 생성은 Yumi Provider Manager의 기존 텍스트 변환 기능이 맡는다. 제공된 1.16.3의 normalized-message 변환은 Risu 원본에 임의로 추가한 documents를 읽지 않으므로 그 방식은 사용하지 않는다. 유미의 모델별 Gemini PDF·전역 수동 지정 설정은 별도로 필요하다. 지원되지 않거나 PDF 변환이 꺼진 모델의 유미 경로는 표식을 제거하고 원문으로 계속한다.

mainContextPdfPrepared는 전체/선택/유지 문자 수·블록 수·범위·사유·transactionId를 기록한다. conversionConfirmed:false와 usage:null을 유지한다. 이 기록은 실제 서버 요청이나 유미 내부 도구 반복 횟수가 아니다. API 사용량·청구 검증은 유미/프로바이더 로그에서 별도로 수행한다. 기존 플러그인 API·Jev 입력·게임 처리·중복 실행·롤백은 변경하지 않는다.

변환할 구간이 없는 ON 요청에는 명시적인 빈 수동 범위를 넣는다. 유미 1.16.3은 빈 범위에서 원문을 유지하며, 범위가 아예 없으면 전체 자동 변환으로 돌아가므로 둘을 구분한다. Nyoru 토글 OFF는 범위 지정만 끄며 PDF 전송 전체 OFF는 유미 모델 설정에서 한다.

요청 메타데이터 참고: [Risu OpenAIChat 정의](https://github.com/kwaroran/Risuai/blob/main/src/ts/process/index.svelte.ts), [beforeRequest 실행과 모델 전달 경계](https://github.com/kwaroran/Risuai/blob/main/src/ts/process/request/request.ts). removable은 호스트의 프롬프트 절삭 표시로 허용하되 attr/thoughts/multimodals/cachePoint에 실제 값이 있는 메시지는 그대로 남긴다.

## 0.30.0 후속 · 준비한 자료와 남은 생성 분리

jev-authoring은 생성 종류, 명시된 대상, 수치의 원문 구간/단위, 물품 준비 필드와 remaining을 만든다. 생성 지침 꼬리를 Jev 요청에 복사하지 않는다. 준비 자료에서 fixed(명시한 이름), selected(분류·수치 해석), evidence(원문 구간), remaining(부족한 필드)을 구분한다. 생성 응답의 수정값을 selected 위에 합친 다음 기존 normalizer/Repository가 검증·저장한다. 완성 여부 판단을 일반 장비·인물·기술에 확대하지 않는다.

jev-preparation은 원문 선별 질문과 구성 요소 질문의 state를 분리한다. 읽지 않은 조각은 보존한다. 기존 인물 후보 추천은 명시적 identityLookup에만 사용하고 평소 새 인물 작성에서는 중복 질의를 하지 않는다. Erencha 단일 물품은 erencha-prompts.ITEM과 짧은 수령인 정보로 준비한다. 확장 기능이 꺼졌고 명시된 금액과 완전한 일반 재료 설명이 있는 경우 plainMaterial 선택과 단위 검증을 거쳐 complete 응답을 조립한다. provider는 이 경로에서 생성 API를 보내지 않으며 그 밖에는 부분 응답을 assemble한다. 게임 실행·사건 지급은 이후 기존 엔진 경로에 그대로 남는다.

actor-lore-search/jev-assist는 관련/미해결/제외 후보를 분리한다. complete 원문에 대한 확신된 무관 판단만 제외하며 발췌와 미검토 후보는 기본 검색에 남긴다. 확정한 자료와 소수 미해결 후보를 모두 읽을 수 있으면 추가 선택 API를 생략한다. 기본 검색이 필요하면 남은 후보만 전달하고 확정 ID를 보존한다. bounded index 밖의 자료는 omitted로 표시한다.

quick-question의 optional field는 정확한 대상과 유일한 저장 항목을 연결할 때 AI를 생략한다. Jev의 확신된 none은 전체 저장 후보가 포함됐을 때만 정보 없음으로 마친다. 후보가 잘렸거나 대상이 모호하면 기본 API가 해석한다. 응답 전 scope/전원/저장 snapshot 비교를 유지한다.

jev-provider의 route/generation과 provider.report는 생성 생략, 후속 전송, 입력 바이트 증감, API가 보고한 usage를 기존 진단에 연결한다. 준비 설명으로 입력이 늘어난 양도 별도 합산하며 UI에는 순증감을 표시한다. 이 계측은 전체 서술 비용이나 청구 절감액을 뜻하지 않는다. 이번 후속 변경은 별도 최종 검사 없이 소스 수정과 배포 생성 범위다.

## 0.30.0 점검 후 로컬 전환

Jev는 기존 선택 기능과 계약을 유지한다. erencha-assistant는 신규 인물의 instanceKey와 저장 인물의 kind/entity를 준비 자료에 전달하며 jev-preparation은 명시적인 새 개체에 정체성 후보를 붙이지 않는다. 원본 생성 AI의 고유 내용 작성, 실제 엔진 검증·저장, 모호할 때 기존 처리로 이어지는 경로는 유지한다.

quick-question의 공통 물품 ID는 instanceId를 우선하고 id를 사용하는 룰북은 기존 값을 쓴다. 저장 ID·소유자·장착 판정과 결과 fact를 일치시킨다. backup의 quote/itemState는 기존 enhancement(0~30)를 선택 필드로 인정한다. game-editor는 무림 스탯 변환을 미리보기의 복제본과 저장값에 일관되게 적용해 runtime migration 후 예상 상태 비교가 잘못 실패하지 않도록 한다.

사용자가 이번에 요청한 최종 점검에서 첨부 기록과 로컬 자동 검사 101건을 확인했다. 실제 설치 호스트 재실행과 새 모델/API 실행은 포함하지 않는다. [전환 안내](nyoru-release-0.30.0.md) · [진단 기록](../artifacts/jev-review-0.30.0/점검-기록.md).

## 0.29.10 Jev 준비 분리

에렌샤 현실 수면 제보 후속: erencha-reality.advance는 접속 중 생활 경과에만 config.timeScale을 적용하고 realm:real 또는 명시적 수면은 1배로 진행한다. 사용자도 away/sleeping을 저장하며 완료 수면과 수면 시작을 구분한다. pendingRealMinutes는 생활 행동에서 처리했지만 현실 시계 표시에는 아직 반영되지 않은 분량이다. 후속 clock의 경과에서 같은 분량을 차감하고 접속 구분이 바뀌면 정리한다. 편집 자료에서는 제외하며 뉴뉴가 다른 값을 편집해도 보존한다. clock sleep:true는 같은 시간 처리 안에서 회복을 적용한다. 과거 영수증 재실행·수치 소급 초기화는 하지 않는다.

summary의 player와 people에 dead/away/sleeping/canAct·경고를 제공하고 erencha-status.packet이 공개 생활 상태를 모든 상태 응답과 주입 자료로 전달한다. rulebook-runtime.prepare/apply 양쪽에서 게임 행동 가능 여부를 확인하며 저장 조회와 실제 생활 행동·관리자 편집 경로는 유지한다. advance의 시간 경과로 행동 불가가 된 인물은 준비한 방어·시전을 정리한다. 새 경고는 결과 changes, 현재 경고는 erencha-ui에 표시한다. 뉴뉴에는 현재 editable.realLife와 ledger의 최근 최대 12개 생활/clock 영수증을 구분해 전달하며 과거 원인을 추정해 단정하지 않도록 지침을 보완한다. beforeRequest 검사는 실제 생활 처리와 경과 영수증을 비교하되 과거 구간을 무작정 재실행하지 않는다.

quick-question은 기존 rpg_state에 읽기 전용 ask(question, actorId?, subject?)만 추가한다. MCP 도구 이름과 모듈 연결 ID는 그대로다. rulebook-runtime의 공통 catalog로 각 룰북·탐색·IPC 스키마를 연결하고 tool-runtime.read의 별도 분기에서 inspect한 현재 채팅의 저장/스테이징 값을 읽는다. 일반 조회의 상태 동기화·전체 상태 패킷·생성 준비·게임 행동 실행을 거치지 않는다.

질문 후보는 저장된 값·통화·개수·소유자·단위와 원래 ID를 가진 제한된 목록이다. 전체 후보·영어 질문·기준을 포함한 입력 한도를 맞추며 Jev의 choice를 실제 후보로 역조회한다. 같은 단어가 있어도 인물·물품이 다르면 모호한 것으로 취급한다. Jev가 확정하지 못하면 기본 연결로 한 번 해석하며 값·실행 계획·일반 지식 답변을 생성하지 않는다. 조회와 무관한 요청은 not_applicable, 정보 없음은 not_recorded, 대상 불명은 needs_clarification으로 구분한다. not_applicable에는 고정 반려 대사를 넣지 않는다. 결과 대기 중 채팅·저장 상태가 바뀌면 이전 답을 폐기한다. 현실 욕구는 erencha-reality.summary의 허용된 경고만 사용하며 숨겨진 수치를 공개하지 않는다.

jev-provider는 System One의 choice 요청·응답 검증, 기기 인증(jevConnection), 입력 한도, 최대 대기·실패 후 60초 보류, 채팅별 입력 캐시와 사용 요약을 담당한다. settings.jev에는 비밀이 아닌 선택값만 저장한다. api-settings-ui → jev-ui가 직접 주소/기본 API 공유/연결 확인/사용 기록을 제공한다. 기본 OFF이며 해당 영역이 꺼지거나 인증이 없으면 기존 경로다.

settings.jev.useDefault가 켜지면 selectedConnection이 기본 API의 알려진 생성 경로를 /v1/systemone으로 교체하고 모델 jev·기본 전송/로컬/키 없는 프록시 설정을 선택한다. selectedSecrets는 기본 인증을 사용하며 별도 Jev 설정과 키를 덮어쓰지 않는다. 실제 요청 주소·헤더로 캐시를 구분하고 공유한 기본 설정이 요청 중 바뀌면 응답을 폐기한다. 진단에는 실제 선택한 주소를 남기고 인증 헤더는 가린다. 직접 설정은 기존 TypeSafe 주소에 제한하지 않는다.

validateQuestions는 영어 질문 지시·선택 기준만 전송하도록 확인한다. jev-assist/preparation은 동적 인물명·기술명·수치·효과명과 룰북 기준을 state에 보관하고 질문에서는 후보 키/목록 위치를 영어로 참조한다. 원문 번역이나 별도 번역 API 호출은 없다.

provider.request의 명시적 preparation 옵션이 jev-preparation을 호출한다. request 경계에서 내부 preparation을 분리하고 buildRequest에는 outputSchema/schemaName만 전달한다. 준비 전후의 생성 요청 검증과 스키마 호환 재요청 모두 내부 옵션을 전송하지 않는다. 기존 생성 요청 형식·인증의 사전 검증 뒤에만 선택적 준비를 실행한다. compiler와 native/erencha/murim/social/tactical assistant, encounter-builder, adventure/native-exploration의 새 자료 작성에 현재 scope와 룰북을 전달한다. 정확한 조회·저장 계획은 기존대로 먼저 반환한다. Jev가 생성 API 자체를 재호출하거나 새 MCP 실행을 만들지 않는다.

jev-preparation은 특정 대상의 긴 sources에서 제한된 원문 조각만 분류한다. 확신된 무관 조각만 생성 입력에서 제외하고 나머지와 원본 job snapshot은 보존한다. 정체성 후보·수치 원문·효과 어휘·환경 분류는 생성 AI가 원문과 대조하는 힌트다. 새 단일 물품의 type/category만 준비 필드로 합치며 생성 AI의 명시적 정정이 우선한다. 어시스턴트는 합친 응답과 원래 응답을 보관하고 기존 룰북 normalizer를 사용한다. 기존 정의 편집에는 자동 기본값을 덮어쓰지 않는다.

인물 생성의 person 또는 인물 kind는 단일 기술 작성과 구분한다. 에렌샤 ensure는 kind가 null이어도 내부 preparation.entity:actor를 전달한다. 생성 지침에 포함된 공통 기술 설명만으로 단일 효과 선택을 요청하지 않는다. 준비 요청은 jev-provider의 inputMetrics/fitsInput을 공유해 state+최대 질문 30,000 UTF-8 바이트·전체 60,000 바이트·60질문 한도를 맞춘다. splitQuestions는 독립 질문을 묶음으로 나누되 한 질문의 선택지는 분리하지 않는다. 질문 하나도 state와 함께 들어가지 않을 때만 선택적 근거 질문을 줄이고 기존 생성 원문은 유지한다. 실제로 선택지를 묻는 효과 어휘만 state에 넣는다.

사용자의 입력 초과 시 추가 호출 요청에 따라 evaluate/evaluateBatches가 유한한 묶음을 순차 실행한다. 로어는 기존 bounded 후보 창의 모든 후보를 해당 질문과 함께 나눠 보내므로 각 묶음에 전체 후보를 반복하지 않는다. 완료된 모든 질문을 원래 키로 합치며 중복 질문 ID를 거부한다. 한 묶음이 실패하면 부분 결과를 확정 답으로 사용하지 않고 기존 처리로 이어간다. 각 요청에 batch.id/index/total을 기록하며 토큰·시간·캐시·실패 로그는 실제 요청 단위다. 취소·채팅 변경·설정 변경은 묶음 사이에도 확인하며 자동 재시도로 요청을 끝없이 늘리지 않는다. 추가 호출은 Jev 판단에만 한정하며 생성 AI 요청이나 게임 행동을 복제하지 않는다.

jev-assist가 로어 후보 선택, 현재 인물의 동일 기술 선택, 허용된 일반 판정 기준, 뉴뉴 지식 주제, 검사 의심 범주를 처리한다. actor-lore-search는 제한된 후보 중 실제 ID만 역조회하고 실패/모호함에 기존 의미 검색을 사용한다. 기술 재사용은 기존 소유 정의를 참조하며 몬스터 인스턴스나 인물을 합치지 않는다. check도 주사위를 선택하지 않으며 무림의 제한된 전용 능력치를 사용한다.

뉴뉴는 최신 질문과 최근 사용자 질문 두 개만 로어 검색 맥락으로 전달한다. 직접 이름 검색은 최신 질문만 사용하고, 의미 검색은 이전 질문으로 후속 요청의 대상을 해석한다. 이전 이름은 후보 순위 자료일 뿐 일치 확정이 아니며 최신 대상이 우선한다. 현재 편집 인물을 기본 검색 대상으로 대체하지 않는다. 캐시 fingerprint에도 사용자 질문 맥락을 포함한다. 이름 경계의 한국어 조사와 제목의 괄호 속 이름을 인식하며 원문·ID·꺼짐 상태는 변경하지 않는다. Jev의 none/unrelated 응답은 확정 불가와 로그 문구를 구분하되 기존 생성·검색으로 이어가는 동작은 유지한다.

nyunyu는 필요한 설명 묶음을 선택하되 현재 룰북의 핵심 지식·단위와 실제 편집 범위를 유지한다. 주제 선택에는 최신 질문과 앞선 사용자 질문 두 개만 전달하고 AI의 이전 답변은 제외한다. 주제가 바뀌면 최신 요청이 우선이며 확신된 no 설명만 제외하고 모호한 묶음은 유지한다. 일반 뉴뉴 대화 API의 원래 대화 이력은 보존한다. turn-review는 Jev 분류를 추가 근거로만 받아 항상 전체 검사와 원래 저장 보완을 수행한다. beforeRequest 대기·영수증·재시도 식별자·사용자 확인·주사위 처리 순서는 바꾸지 않는다. 결과/캐시는 해당 채팅·분기·모델·설정·입력에 묶이며 취소/채팅 변경/종료를 따라간다.

jev-diagnostics는 사용자 요청에 따라 실제 전송 본문·응답 원문·해석 결과·후속 선택을 별도 urpg/jev-diagnostics/v1/에 보관한다. 인증정보는 저장 전에 가리고 전역 200건·16MB 한도를 적용한다. 배경 저장 큐는 게임 거래와 분리하며 실패는 진단 안내로 남긴다. 요청/응답에 같은 ID를 사용하고 캐시·취소·시간 초과·미완료를 구분한다. 내보내기는 현재 채팅 또는 전체를 선택하며 storage-manager의 채팅/진단 삭제와 연결한다. 호스트 진단은 기존 요약 이벤트만 받는다.

입력 한도 검사 전에 계획한 요청을 journal에 기록한다. 전송하지 않은 제한 초과는 networkRequest:false·stage:preflight와 input/limits/error.details로 남기고 후속 fallback도 같은 요청 ID에 연결한다. 한도에 맞춰 보낸 준비 질문 수와 원문 유지 여부는 bounded 결정 기록에 연결한다. 유효 요청·캐시의 집계와 저장 상한은 유지한다.

[연결과 적용 범위](nyoru-release-0.29.10.md). 0.30 전환은 실사용 후 결정하며 이번은 로컬 배포 생성 범위다.

## 0.29.9 결산·처치 공유·인물별 현실 생활

combat-resolution은 기존 gameplay/erencha-engine/tactical-combat의 실행을 묶어 한 호출의 시작/종료 상태와 실제 영수증으로 combatSummary를 만든다. resultsOnly와 위임 권한이 있을 때만 계산 범위를 늘린다. 결과 정체·계산량·시간 경계에서는 현재 상태를 남기고 미완료를 알린다. 임시 집계는 WeakMap으로 보관하며 rulebook-runtime.apply 마지막에서 부가 처리 이후 다시 집계한다. 세부 steps는 원본 ledger에 남긴다.

result-record의 display 선택만 summary를 한 장으로 취급하고 render/combat-summary-ui가 결산 카드를 만든다. tool-result-view는 메인 AI 응답에서 그 전투의 상세 steps와 중복 상태 자료를 결산으로 대체한다. 내부 계산과 재시도 식별자·저장 결과는 유지한다. combat-options/play-options/play-settings-ui/초기 구축/뉴뉴가 같은 토글을 사용한다.

party-xp는 같은 전투/진영의 사용자·동료를 선택해 기본 처치 경험치의 split/full 몫을 만든다. native-rpg/hunter-rpg/erencha-engine의 기존 처치 완료 경로가 각 룰북의 XP 함수로 지급한다. OFF는 이전 경로다. 새 공유량에도 기존 defeated/defeat 사건 중복 방지를 사용한다.

erencha-reality는 기존 사용자 root 현실 상태와 config를 보존하고 people[actorId]에 다른 온라인 이용자의 욕구·건강·away/sleeping을 추가한다. actor-presence의 현재 표시/전투 참가 avatar만 elapsed 분을 같이 적용한다. 게임 NPC와 몬스터는 제외한다. 당시 timeScale(기본5)은 모든 새 경과 분에 적용했으나 0.29.10의 수면 제보 후속에서 위와 같이 접속 중 배율과 실제 현실 생활·수면을 분리했다. 게임 달력 변화만으로 현실 경과를 추정하지 않으며 optional-feature-actions의 게임 안 대기도 현실 경과로 중복 적용하지 않는다.

real_life는 기존 도구 분기에서 실제 생활 행동/개인 자리 비움/복귀를 기록한다. NPC 회복은 대상만 변경하며 경제는 원래 사용자에게만 남긴다. 다른 아바타의 수면 시작 후 공유 시간이 지나면 해당 인물만 수면 회복을 받는다. erencha-engine의 자동 행동·연계와 guard가 현실 행동 불가를 확인한다. summary/context에는 이름별 경고와 자리 비움만 제공하고 상세 욕구는 nyunyu.editable(actorId)와 충돌 확인 편집으로 관리한다. 실제 대사는 강제하지 않는다. [사용 안내](nyoru-release-0.29.9.md).


## 0.29.8 등록 인물 표시 그룹

registry-ui는 기존 표시 대상 중 kind:enemy인 인물을 명시적 sceneActorIds·playerActorIds·combat.order와 비교해 나머지를 적·몬스터 기록으로 접는다. Presence.ids의 구형 active 전체 표시 기본값은 분류 근거로 사용하지 않고 현재 상태·미니보드의 표시 동작은 유지한다. 인물 검색은 두 그룹을 함께 검색하고 적 결과도 자동으로 펼친다. 같은 카드·편집 버튼·장면 선택 저장 경로를 재사용하며 별도 데이터 보관/삭제 작업은 만들지 않는다.

registryEnemyRecordsOpen은 UI의 일시적 펼침 상태이며 채팅 scope가 바뀌면 초기화한다. native details의 펼침은 화면 전체를 다시 그리지 않으므로 작성 중 편집값을 지우지 않는다. 검색 때문에 자동으로 펼친 상태는 일반 펼침 설정에 저장하지 않는다. [사용 안내](nyoru-release-0.29.8.md).

## 0.29.7 로어북 검색과 선택 기능 표시 연결

host.sources는 현재 대화 자료에서 꺼진 로어 항목도 읽는다. source-selection-ui는 참조 가능 표시를 붙이고 초기 자동 선택에는 꺼진 항목을 추가하지 않는다. actor-lore-search는 최초 선택 밖의 이름·키워드·정체성 원문을 검색하며, 실패 시 기존 provider로 제한된 목록에서 의미 후보 ID를 받아 실제 항목으로 역조회한다. 없는 ID를 원문처럼 사용하지 않는다. 검색에는 조건·매크로를 실행하지 않는다. 원문 읽기와 의미 검색 메타데이터를 actorLoreSearch/nyunyuLoreSearch 진단에 남기고 뉴뉴 화면에서 참조 목록을 표시한다.

에렌샤 내장 catalog도 새 등록 때 현재 로어를 검색한다. setup-request가 초기 추가 요청의 대상 인물을 구분하고 새 인물 준비에는 개인 요청을 넘기지 않는다. 초기 선택 페르소나가 다른 인물 자료로 섞이지 않도록 actor-lore-search에서 신원을 대조한다. 현재 저장 인물·사용자 편집은 그대로며 새 몬스터의 명시적 템플릿 복제는 다시 AI 검색하지 않는다.

UI.tabs는 꺼진 구축 단계의 featureDraft 편집·뉴뉴 화면을 허용한다. optional-feature-ui → game-editor → compiler의 기존 초안 저장을 유지한다. runtime-details-ui는 metre profile.ranges와 네 거리 accuracy를 따로 표시한다. optional-feature-tools와 조회 summary가 활성 단위를 안내하고 실효 사거리를 보여 준다. 다른 룰북의 전투 계산을 합치지 않는다.

actor-reference.combatName은 조우·전투의 전체 인물 목록에서 같은 이름을 구분하며 게이지·턴테이블·판정 카드가 함께 사용한다. card-information은 저장 결과 HTML 조각에만 간결 표시를 적용하고 상세를 남긴다. module-bridge의 cardCompact는 채팅별로 저장하며 backup에서 간결/호환 설정을 복구한다. 테마별 outline과 inline fallback을 함께 조정한다. [사용 안내](nyoru-release-0.29.7.md).


## 0.29.6 무림·택티컬 표시 테마

module-settings의 기존 테마 뒤에 무림 4·택티컬 5를 추가한다. 테마 선택 UI와 module-bridge, 백업의 기존 목록 검증을 그대로 사용한다. build-legacy의 테마 목록이 두 CSS를 theme-data와 배포에 포함한다. 기존 숫자 선택과 모듈 식별자는 변경하지 않는다.

themes/murim.css와 tactical.css가 일반 판정·간결형 전투·여덟 결과 종류를 같은 테마로 표시한다. card-ornaments는 summary에 해당 테마의 장식을 추가하고, 같은 테마의 호환 표시에서 이미 적용한 장식은 유지하며 테마를 바꾸면 자기 장식만 교체한다. event 카드도 새 테마 장식을 사용하고 보급·의료·정비의 형태는 저장된 data-kind로 고른다. 실제 결과의 success/failure와 critical을 사용하고 시안의 숫자나 부상·보상을 새로 저장하지 않는다.

card-inline-style과 event-card-view의 대체 표시에도 두 팔레트를 추가한다. CSS 파서가 없으면 장식을 숨기고 읽을 수 있는 배치와 결과 색상을 유지한다. 기존 스타일 후면 삽입·사용자 CSS 순서는 유지한다. 소스 수정·로컬 배포 생성 범위이며 실제 RisuAI 표시 및 별도 최종 검사는 실행하지 않는다. [적용 안내](nyoru-release-0.29.6.md).

## 0.29.5 표시 모듈과 카드 스타일 순서

card-themes.decorate는 기존 자기 스타일을 제거하고 테마 클래스를 붙인 뒤 스타일 블록을 표시 내용 맨 뒤에 추가한다. 소악마 기본 모듈의 Thoughts 제거처럼 # Response 이전의 HTML 태그를 지우는 표시 정규식이 NyoruRPG의 스타일까지 제거하지 않도록 한다. 일반 style 태그 형식, 카드별 CSS 범위, 기본→테마→사용자 CSS 순서는 유지한다. 카드 본문의 원래 삽입 위치나 세이브·MCP·AI 지침은 변경하지 않는다.

제공된 모듈의 정규식과 공식 Risu processScriptFull의 플러그인→표시 정규식 처리 순서를 읽어 확인한 충돌이다. 실제 설치 환경에서 함께 실행한 결과는 별도 확인되지 않았다. [적용 안내](nyoru-release-0.29.5.md).

## 0.29.4 테마별 결과 카드

event-card-model은 기존 룰북별 presentation과 영수증을 읽어 획득·회복·거래·성장·퀘스트·탐험·효과·강화 표시 자료를 만든다. render의 presentation은 기존 계산 경로를 유지한 채 이 표시 자료를 연결하며, cardHTML/receiptHTML이 event-card-view에 원래 상세 내역을 넘긴다. 저장된 before/after/max가 있는 회복만 막대를 그린다. 인물 이름 외에 현재 게임 상태를 읽어 과거 자원·잔액·보상을 만들지 않는다.

event-card-style은 공통 배치, themes의 각 파일은 승인된 테마를 담당한다. 새 카드에는 전용 꽃·마법진·회로 장식이 있어 card-ornaments의 기존 전투 장식을 중복 추가하지 않는다. card-inline-style은 같은 CSS를 직접 적용하고 파서 미지원 시 event-card-view의 기본 배치와 팔레트를 사용한다. CSS 범위는 결과 카드 안으로 제한한다. 게임 스키마·MCP·AI 지침·주사위·저장 식별자는 변경하지 않는다. [카드 안내](nyoru-release-0.29.4.md).

## 0.29.3 카툰과 밤빛 마도서 표시

themes/cartoon.css를 공통 chat-style에서 분리해 기본 카툰의 도형·서체를 적용하며 로맨스·사이버에는 영향을 주지 않는다. themes/fantasy.css는 남색 마도서와 실제 판정의 success/failure·critical 클래스에 따른 네 장식을 담당한다. 기존 favorable/unfavorable 판정 자료는 그대로다. combat-card-style의 간결형 배치는 보존하고 판타지 팔레트만 연결한다.

card-ornaments는 판타지 결과 카드의 summary 안에 화면용 장식만 추가한다. card-inline-style과 card-themes가 같은 함수를 사용하며 이미 들어간 장식은 중복 생성하지 않는다. 다른 테마에서는 해당 장식 블록만 제거한다. 룬은 CSS의 data-rune 표시로 만들어 스타일이 사라져도 장식 문자가 본문에 이어 붙지 않게 한다. 호환 표시의 CSS 파서가 지원되지 않으면 장식을 숨기고 해당 테마의 기본 색상과 글자 배치를 사용한다.

render의 피해·회복 숫자에 표시용 span을 추가한다. 저장 판정, 피해량과 비용, AI 지침, 주사위와 게임 상태는 수정하지 않는다. build는 네 테마 CSS를 묶으며 기존 모듈 v1의 연결 구조를 유지한다. [테마 안내](nyoru-release-0.29.3.md).

## 0.29.2 저장 결과 카드의 공통 표시

combat-card-view는 게이지·턴테이블의 저장된 행을 간결형 HTML로 만든다. action-gauge.html과 render의 turnsHTML이 이를 사용하며 tactical-ui의 presentation은 저장된 좌표·준비 시간·선공값을 같은 표시 자료로 연결한다. 실제 전투 스케줄러는 변경하지 않는다. 게이지의 새 표시 스냅샷에는 선택한 미터/칸 단위를 함께 보관하며 예전 결과에서 없는 값은 추정하지 않는다. 에렌샤 턴테이블은 같은 영수증의 range를 표시 행에 연결한다.

combat-card-style은 채팅과 플러그인 내부 게이지가 사용하는 공통 배치다. chat-style은 일반 판정·변경 내역·영수증의 글자 크기와 줄바꿈을 담당하고 네 테마가 색상과 장식을 덧붙인다. 카드 호환 표시의 직접 스타일과 대체 배치에도 새 구조를 연결한다. card-themes는 combat 등 카드 자체의 루트 선택자를 그 카드에 범위 한정한다. 사용자 CSS는 기존처럼 후순위에 보관한다.

거래·성장·효과 내역은 변경 항목과 값을 나누고, 저장된 판정 상세·피해·비용은 보존한다. 마커 해석과 출력 위치, 저장된 게임 결과·AI 지침·도구 목록은 바꾸지 않는다. [표시 범위](nyoru-release-0.29.2.md).

## 0.29.1 카드 표시 범위와 호환 선택

card-themes는 기본 배치와 @container/SVG 장식 규칙을 별도 style 블록으로 출력하며 원래 소스 순서와 사용자 CSS의 후순위 적용을 유지한다. gauge 루트도 카드 자체의 테마 클래스와 결합한다. chat-presentation-ui의 cardCompatibility는 module-bridge의 기존 채팅 설정에 저장하고 누락/false는 원래 표시로 읽는다.

app.display가 선택값을 읽어 renderStoredText에 formatCard를 전달한다. renderStoredText는 캐시한 게임 결과를 바꾸지 않고 출력할 결과 조각에만 formatter를 사용한다. 주변 서술 전체를 DOM으로 읽지 않는다. card-inline-style은 샌드박스의 CSS 파서로 기본 제공 테마를 읽고 일치하는 요소에 직접 적용하며 지원하지 않는 환경에서는 기본 배치와 테마 색상을 사용한다. 사용자 CSS를 실행하거나 호스트 DOM에 접근하지 않는다. 기존 모듈 CSS는 전환 전까지 보존하며 호환 표시를 명시적으로 켠 경우에만 인라인 처리를 추가한다. [사용법과 미확인 범위](nyoru-release-0.29.1.md).

## 0.29.0 룰북별 선택 기능

optional-features는 룰북별 허용 목록과 채팅 meta.optionalFeatures의 토글을 관리한다. 누락은 OFF이며 원래 룰북 데이터와 별도로 저장한다. optional-feature-schema/model은 직접 편집·초안·뉴뉴가 공유하는 전체 자료 계약, 켜진 필드만 보여 주는 편집 스키마, 참조와 수치 검증을 제공한다. 끌 때 자료를 지우지 않으며 기존 룰북의 기본 기능도 끄지 않는다.

optional-feature-combat은 호출 문맥의 무기·조준 부위, 파츠, 탄약, 무게, 미터 거리, 부위 피해를 공통 Engine/FX/Range와 에렌샤에 연결한다. 후보 세계 복제에도 해당 호출 문맥을 전달하고 종료 시 폐기한다. 택티컬/지르코트의 기존 파츠·시간·신체·탄창은 재사용하며 선택 연계와 개량만 별도로 연결한다. 미터 위치는 선택 기능 전투 자료에 저장하므로 기존 네 거리 좌표를 재해석하지 않는다.

optional-feature-actions는 상인 거래·퀘스트 보상·수련·생활·소환·개량을 처리한다. 기존 인물 권한, 행동 차례, 난수, 끝난 전투 정산과 트랜잭션을 사용한다. eventId와 실제 작업 대상, 퀘스트 보상 영수증으로 같은 처리를 반복하지 않는다. 알려진 보상/재고 물품 정의는 보관해 원본 물품을 소비하거나 판매한 뒤에도 지급한다. 새 서사나 상품을 임의 생성하지 않는다. API 대기와 조회는 시간을 진행하지 않으며 실제 경과 시간만 생활 수치와 비용에 반영한다. 출혈은 교전 중 자기 차례 종료, 교전 밖 시간으로 구분한다.

optional-feature-tools가 현재 켠 기능에 한해 기존 rpg_play의 feature와 rpg_state의 features 분기를 제공한다. 켜진 기능과 관련된 자료만 메인 AI에 안내한다. 별도 MCP 이름·연결·재호출 프로토콜·보조 API를 추가하지 않는다. 선택 기능 호출은 기존 rulebook-runtime의 관리자/메인 실행과 검증을 공유한다.

optional-feature-ui/operations-ui는 플레이 설정·초기 토글·초안 편집·기존 메뉴의 세부 설정과 실제 행동 버튼을 연결한다. 새 범주도 등록 인물 앞에 배치한다. compiler는 초안의 선택값과 편집 자료를 보관하고 적용 시 실제 인물·장비·기술 참조로 이어 준다. 같은 이름의 별도 적은 합치지 않는다. 뉴뉴의 초기 초안 질문과 실제 게임 질문을 구분하고 제안 당시 자료가 바뀌었으면 덮어쓰지 않는다. [사용 방법과 구현 범위](nyoru-release-0.29.0.md).

## 0.28.11 기술 재사용 대기

skill-cooldown이 공통 엔진의 기술 재사용 설정·남은 대기·사용·자기 차례 종료를 연결한다. D100 계열은 새 정의/사용자 편집의 cooldownEnabled:true에만 기존 cooldown 정수를 적용하여 과거 무시하던 값을 자동으로 활성화하지 않는다. native-assistant의 신규 인물/기술과 murim의 공용 ability 작성이 원문 또는 요청된 cooldown을 보존한다. 원래 레거시 비-native 쿨다운 방식은 유지한다.

일반 행동을 사용하는 자기 차례에 발동하면 skillState.cooldownSkipEnd가 그 차례 끝의 감소 한 번만 건너뛴다. 외부 차례에 사용한 방어·반응·연계는 다음 자기 차례부터 감소한다. 효과·기절 상태를 만들어 기술 전체를 막지 않으며 해당 기술 ID의 gates만 확인한다. 자동 조건 발동도 같은 카운터를 확인하고 지불 후 시작한다. 최대 재사용 대기 1000을 넘기지 않아 기존 cooldown 저장 범위를 유지한다. 선택 필드 cooldownEnabled와 cooldownSkipEnd는 이전 자료에 없어도 유효하다. 전투 종료는 기존 skill-casting.reset에서 카운터/표식을 함께 초기화한다.

공통 skill-editor.patchSchema에 cooldown을 추가해 구축 초안·일반 편집·뉴뉴 제안이 동일 revise를 사용한다. 기술 편집 비용·사용 조건에는 효과 유무와 무관하게 재사용 대기와 공격 시전 대기를 표시한다. effect-editor의 별도 시전 입력은 이 화면에서 숨겨 같은 설정이 두 곳에서 충돌하지 않는다. skillNumbers·sheet·전체 기술 목록·미니보드가 적용 중인 대기를 읽는다. 에렌샤는 기존 저장/계산을 보존하며 시전 입력 위치만 함께 옮긴다.

## 0.28.10 제보 후 공통 복구 경로

scene-reconciliation은 내부 검사와 사용자 편집용 완료 장면 보완이다. 공개 MCP 목록에는 새 진행 도구를 추가하지 않는다. turn-review가 최종 서술 원문을 대조한 뒤 내부 reconcile을 호출하고 tool-runtime의 기존 트랜잭션으로 원자적으로 저장한다. 이 경로만 기존 숫자 감소 확인에서 제외하며 등록된 적만 대상으로 한다. native/Hunter의 기존 처치 경험치 표시, 에렌샤의 defeat 사건, native-obtain 및 탐험 claimed를 재사용하여 중복 지급을 막는다. 정의되지 않은 전리품은 생성하지 않으며 unpreparedLoot로 남긴다. 룰북에 없는 보상이나 지난 타격별 숙련을 추측하지 않는다.

뉴뉴의 scene_resolution 제안은 같은 보완 함수를 game-editor의 현재 스냅샷 확인 뒤 실행한다. 검사 입력 편집도 내부 보완 스키마를 사용한다. game-editor-ui와 review-issues-ui는 닫힌 편집기의 입력값과 중복 저장을 방어한다. 신규 인물의 정확한 기존 이름/ID는 새 개체 키보다 우선하고, 이전 이중 식별자 중복은 기록을 보존하며 전투 참가 목록에서 제외한다. mergedInto는 공통 백업의 선택 필드다.

gameplay의 전투 중 탐험 조우 조회는 null로 구분한다. false 값 뒤 enemies.map에 접근하던 실제 예외를 제거한다. combat-range.profile은 장착 무기와 사용 기술의 최대 사거리 중 높은 값을 사용한다. range.absolute는 공통 장비/기술 편집·스키마·저장·계산에 연결하며 사용 기술 고정값 → 무기 고정값 → 두 최대값 비교 순이다. 고정 상태에서는 rangeBonus로 바꾸지 않고 거리별 명중 보정은 별도로 유지한다. 택티컬의 미터 거리 계산은 별개다. UI는 표시 이름에서 저장된 instanceKey 접미사만 줄이며 실제 ID를 바꾸지 않는다.

setup-retry는 명시적인 재시도 시 새 작업의 깨진 응답 캐시만 비우고 원래 작업을 보관한다. 잘못된 장비 효과는 해당 효과만 보완 요청할 수 있고 보완 전 자료를 남긴다. 유효 후보 초안은 다시 생성하지 않고 확인한다. 무림 준비는 현재 경지표에 맞는 경지와 여덟 필수 스탯이 누락되면 해당 정보만 한 차례 보완 요청한다.

generation-rollback은 같은 채팅의 생성만 폐기하고 저장된 open-tx 연결을 정리한다. rollback-ui가 호스트의 실제 사용자/답변 원문과 이력 서명을 보여주고 선택값을 적용 시 다시 확인한다. 이전 시점 복원 마커는 화면 새로 고침으로 최신 상태에 덮이지 않으며, 다른 답변을 잘못 이어가는 경우 선택한 Risu 답변의 재생성을 안내한다.

## 0.28.10 구축 초안과 복구 편집

tactical-ui는 편집창 위·아래의 저장과 저장 없이 돌아가기를 같은 처리에 연결한다. ui.jobPanel과 onboarding은 편집 중 재시도·최종 적용·이전 단계 이동을 숨긴다. compiler.editTacticalDraft는 실패한 후보도 허용하며 관리자 편집의 내부 draftEdit 문맥에서 전체 세계 검증을 지연한다. 수정 후보를 기존 backup.validateWorld로 확인하여 오류가 남으면 failed와 수정 자료를 같이 보관한다. 실제 게임의 관리자 편집과 최종 적용 검증은 그대로다.

완성 후보가 있는 택티컬·지르코트의 단순 재시도는 revalidateSavedDraft로 같은 후보만 확인한다. 후보가 없으면 기존 prepareRepair/run을 사용하며 새 작업 ID를 onboarding의 setup.jobId에도 저장한다. 자료를 다시 생성하는 명시적 수정 요청은 별도이다.

recovery-ui는 후보·인물 facts·원문 응답·중간 전체 자료 순으로 대상을 제공한다. 질문 버튼이 실제 수정 대상을 열어 오류와 함께 전달하며, nyunyu는 요청 시점의 scope/job/path/원값/입력 스냅샷을 제안에 묶는다. 오류 후보의 일반 게임 요약이 실패해도 원본 자료는 수정 문맥으로 전달한다. 제안 열기와 저장에서 오래된 대상의 덮어쓰기를 막는다.

compiler.repairSavedDraft가 택티컬 중간 자료를 수정하면 기존 후보는 작업의 recoveryPreviousCandidates에 보관하고 수정한 중간 자료로 이어 만든다. 이미 소비한 원문 응답 수정은 tactical-assistant.repairResponse가 바뀐 필드만 facts에 연결한다. 이후 자료나 직접 편집과 겹치는 변경은 EDIT_CONFLICT로 남겨 인물 facts를 직접 수정하도록 안내한다. 현재 게임·주사위·도구 재시도·IPC에는 새 실행을 추가하지 않는다. [사용 순서와 확인 범위](nyoru-release-0.28.10.md).


## 0.28.8 전투 저장 정의와 효과 작성 경계

combat-range.init은 actor.rangeRepositioned와 combat.range(version/positions/startDistance)를 생성한다. backup의 공통 상태 스키마에서 이 둘이 빠져 실행 후보 상태를 거부했다. 이동·공격이 기록하는 불리언과 0~3의 실제 전장 좌표를 선택 필드로 추가한다. 같은 전투 흐름의 meta.skillCasting, preparedDefense, tacticalChoice도 실제 작성 구조에 맞춰 연결한다. 모든 새 필드는 이전 저장에 없어도 유효하다. 에렌샤는 erencha-rules.validateWorld를 별도로 사용하므로 이번 오류와 같은 추가 필드 거부를 하지 않는다.

effect-presets의 작성 변환은 type:status의 명시된 status/preset 또는 알려진 target/name/effect를 기존 프리셋으로 연결한다. 저장 효과 종류를 늘리지 않는다. 지속시간·확률·전달 조건은 유지하고 프리셋의 정규 status ID를 사용한다. 이름이 없거나 해석할 수 없거나 서로 다른 프리셋을 가리키면 EFFECT_STATUS와 효과 위치·원본 행·예시를 반환한다. 원래 구체적인 효과 type과 stat→raw 경로는 유지한다.

공통 저장 검사에서 난 INVALID_SCHEMA에는 runtime_state_schema 표시를 붙인다. util.errorResult가 같은 저장 형식 오류와 효과 작성 오류를 구분하여 상세·복구 안내를 보존한다. Repository의 실패 영수증 재사용은 유지하며 조회·인수 변경·scene_reset을 코드/자료 오류의 복구 수단으로 안내하지 않는다. 정상 호출과 후속 행동의 횟수·자동 진행·카드 위치·호스트 대기시간은 변경하지 않는다.

확인 범위는 첨부 텍스트와 관련 소스 읽기·수정, 로컬 배포 생성이다. 첨부에는 실제 효과 행·호스트 진단 시간 정보가 없어 해당 status 행의 정확한 내용과 전체 지연은 미확인이다. 별도 최종 검사·실제 RisuAI·모델 실행·GitHub 게시는 수행하지 않는다.

0.28.7 추가 수정: murim-realms.generate와 fromSource가 새로 만드는 경지표의 outer/inner만 정수 반올림한다. 작은 배율·많은 단계로 반올림 값이 겹치면 다음 문턱을 올려 단계 증가 조건을 유지한다. 성장 배율·실패율·이미 저장한 경지표의 validate/config와 수행 방향별 보정 계산은 바꾸지 않는다. 사용자가 같은 0.28.7로 묶어 GitHub 게시를 승인했다. 수정 소스와 배포 생성 범위이며 별도 검사·실사용 실행은 생략한다.

## 0.28.7 무림 경지 자동 구축 선택

기존 murim-realm-ui의 setup 버튼은 custom 선택 즉시 수동 editor를 열었고 source:lore 체크 항목은 editor 밖 setup 요약에만 있었다. 초기 구축의 custom 버튼은 이제 source:lore를 직접 선택하며 editor를 열지 않는다. 유효한 기존 stages와 직접 편집 자료는 보관하되, lore 모드에서는 기존 murim-assistant.run이 경지표를 추출한 뒤 인물을 준비한다. 기본 경지와 이미 저장한 수동 설정은 명시적으로 선택을 바꿀 때까지 유지한다.

수동 작성은 별도 details 아래 버튼으로 연다. 수동 저장은 source:manual로 바꾸고 취소는 기존 자동/수동 선택을 보존한다. onboarding의 다음 단계 저장은 기존 buildSetup을 쓰므로 직접 작성 중 다음 단계로 가면 그 입력값을 사용하는 기존 동작도 안내한다. sources 단계에 경지 자료를 고르라는 sourceHint를 표시한다. 실제 준비 결과/플레이 요약은 저장된 표의 개수·이름·문턱을 읽어 표시한다. 새 API 단계·보조 모델·세이브 식별자는 추가하지 않는다.

필요한 소스 연결 수정과 로컬 배포 생성 범위다. 별도 최종 검사·브라우저·모의 호스트·실제 RisuAI·모델 실행은 수행하지 않는다. 기존 게임 재구축 시 현재 경지표 보존, 직접 편집 및 백업 호환을 유지한다. 범용 기능 확장은 계속 보류한다.

## 0.28.6 구축 능력치 효과

사용자 0.28.5 오류의 effect-presets.expand → compile → native-rpg.item/items → murim install 경로는 생성 효과 type:stat을 해석하지 못했다. authoringRow는 이 작성 별칭을 raw로 변환하고 target/stat/key의 명시된 능력치를 읽는다. 저장 효과 종류와 실행 엔진은 그대로다. 이미 target이 정해진 raw 효과는 그 대상을 유지하며 다른 편집 필드로 바꾸지 않는다. 새 stat 입력의 누락·상충 대상이나 비수치 값은 수정 위치와 원본 행을 오류 상세에 보관한다. 임의 와일드카드·효과 삭제로 구축을 통과시키지 않는다.

native-rpg.item과 native-assistant.ability는 기존 룰북 statKey를 전달한다. murim-stats는 변환 전 stat/raw의 기계적인 대상·키를 무림 스탯으로 정리하며 설치 후 기존 정리 경로도 유지한다. 장비 오류에 소유 인물·물품·필드를 추가하고 생성 지침에 raw의 정확한 예시를 제공한다. 원본 응답/중간 facts를 지우지 않으므로 기존 prepareRepair와 murim-assistant의 보관 자료 재사용 경로에서 다시 변환할 수 있다.

제보에는 실패한 효과의 전체 값이 없고 종류 stat과 스택만 있다. 해당 소스 경로 수정과 로컬 배포 생성 범위이며 실제 사용자 초안·RisuAI·API 실행과 별도 검사·테스트는 수행하지 않는다. 공용 기능 확장은 계속 보류하고 모듈·MCP/IPC·경지·기존 세이브 식별자는 바꾸지 않는다.

## 0.28.5 무림 초기 설정

사용자 오류 스택의 setupValue → buildSetup → onboarding.persist 경로에서, 초안이 없는 새 채팅은 clone(undefined)가 기본값 선택보다 먼저 실행됐다. murim-realm-ui.setupValue에서 저장값 또는 기본값을 먼저 선택하고 그 객체만 복사하도록 수정한다. null/누락 설정은 기본 경지로 시작하며 현재 UI 편집값과 저장된 초안은 그대로 이어받는다. 공용 clone, 경지 계산, 저장·도구 연결은 변경하지 않는다.

수정 소스와 로컬 배포만 생성한다. 별도 최종 검사·테스트·실제 RisuAI·API 실행은 사용자 지시에 따라 생략한다. 아직 연결하지 않은 공용 기능 확장 소스는 work-in-progress/shared-features에 보관하여 배포 번들에서 제외한다.

## 0.28.4 무림 경지표

murim-realms는 기존 23경지와 meta.murim.realmConfig의 커스텀 경지표를 읽는 단일 경로다. 누락 설정은 기본 표로 읽으며 저장 조회로 마이그레이션하지 않는다. 현재 경지 숫자는 유지하고 표 변경 시 ID/이름 및 사용자가 확인한 대응표로 인물·기술 minimumRealm·가르침·비전 장 참조를 함께 옮긴다. 인물의 수치·자원·숙련·영수증은 그대로다. 전투 중 변경과 오래된 편집 스냅샷은 차단한다.

murim-realm-ui는 초기 구축·구축 초안·플레이 설정·뉴뉴 제안의 같은 편집 화면을 제공한다. compiler는 murimSetup과 준비한 realmConfig를 보관하며 기존 무림 재구축은 현재 경지표를 이어받는다. 선택 자료에서 가져오기를 선택한 새 구축만 경지 목록 추출을 추가한다. 일반 인물/기술 준비 캐시와 적용 전제에 경지표를 포함하여 다른 표에서 준비한 결과를 그대로 저장하지 않는다.

murim-growth는 표의 문턱과 성장·실패 설정을 쓰며 경지 격차는 전체 단계에서 1~23의 상대 위치로 비교한다. 기본 표 계산은 동일하다. 현재 상태는 실제 경지 이름·돌파 조건을 내보내고 프로토콜은 사용자 지정 사망 기준을 따른다. 기술 편집·가르침 편집의 범위와 뉴뉴 지침도 현재 경지표를 사용한다. 별도 MCP 호출·연결 이름·모듈 지침 위치는 추가/변경하지 않는다. [사용법과 미확인 범위](nyoru-release-0.28.4.md).

## 0.28.3 준비 자료와 생성 경계

tactical-authoring은 초기 구축과 신규 인물 등록의 장비 수량을 개별 물품으로 나누고 생성 자료 내부 ID 참조를 새 인물의 ID에 맞춘다. tactical-assistant는 임시 세계에 실제 설치한 인물·소지품·기술을 capture하여 계획에 보관한다. 적용 시 원문을 다시 설치하며 다른 ID를 만들어 연결을 잃는 경로를 줄인다. 빈 선행 조건과 잘못 생성된 손 태그를 구분하며 실제 기술 ID는 유지한다. 지르코트 실물 탄창의 한쪽 연결을 맞추고 기존 인물은 손대지 않는다. 새 공격의 대상 누락은 rulebook-runtime에서 prepare 전에 반환한다. tactical-tool-errors가 호출·준비 인물·필드·다음 수정 방향을 설명하고 시간 기록과 공격 결과를 구분한다.

lifecycle.selectHistory는 현재 Risu 메시지 ID·원문 해시에 맞는 저장본을 선택한다. 생성마다 Repository.begin의 새 transaction/generation ID를 사용하므로 새 분기에서 버린 답변의 주사위·상태·이벤트 영수증을 재사용하지 않는다. 같은 생성의 actionId 재시도는 기존 영수증을 사용한다. generation-rollback은 수동 편집 저장의 변경 전 값을 비교하여 충돌 없는 편집만 복원 기준에 적용한다. 충돌은 /last-rollback에 보관하며 기존 불변 revision은 삭제하지 않는다. 새 manual origin과 기존 manual 사용자 메시지 ID를 모두 읽는다.

호스트에는 별도 리롤/취소 이벤트가 없다. afterRequest만으로 중단/리롤을 확정하지 않으며, 미완료 답변은 rollback-ui의 명시적 되돌리기로 /reroll-request를 만들 수 있다. 이 표식은 화면 새로고침이 아직 남아 있는 원래 답변의 상태를 다시 선택하지 않도록 하고 새 요청이 소비한다. 채팅 원문은 수정하지 않는다. 도구 수신 시 transaction ID를 함께 묶고 명시적으로 폐기한 생성의 IPC 대기 작업을 취소한다. host.verifyTransaction이 폐기된 생성의 결과를 막으며 output 도착 당시 소유한 transaction도 확인한다. 카드 본문·순서·원문 대체 방식은 그대로다.

review-issues는 실제 현재 대화의 메시지 ID와 서술 해시로 다른 답변의 알림을 숨긴다. 기록·입력 초안은 남아 있고 그 답변을 다시 선택하면 확인할 수 있다. 전역 API 설정이나 연결 식별자는 롤백하지 않는다. [배포 범위·사용법·실사용 미확인 사항](nyoru-release-0.28.3.md).

## 0.28.2 공통 UI와 선택 관리

play-navigation이 공통 메뉴 순서·이름과 이전 화면 ID의 표시 별칭을 관리한다. 저장 ID는 바꾸지 않는다. registry-ui는 룰북별 편집기를 재사용하고 새 인물은 기존 Rulebooks.prepare/apply와 관리자 트랜잭션으로 준비·저장한다. 현재 장면 표시 목록은 등록 이전 목록과 사용자 선택으로 유지하며 로어 자동 검색·헌터 내장 활성화 경로를 재사용한다. 준비 도중 채팅·대화·전원이 바뀌면 적용을 중단한다.

play-settings-ui는 공통 전투·이동·탐험과 룰북 옵션을 같은 화면에서 편집하며 스냅샷 충돌 확인 후 기존 전투 옵션에 저장한다. tactical/zirkott는 전용 시간 계산을 유지하고 지원하지 않는 HP 감소·부활 설정을 추가하지 않는다. inventory-ui는 장비 여부 판별·안쪽 탭·인물 선택창을 공유한다. 각 룰북의 기존 물품 편집·장착·효과 저장은 그대로 사용한다.

zirkott-options는 karmaEnabled/commerceEnabled의 선택 여부와 실행 입구 차단을 맡는다. 누락은 OFF로 읽고 이전 자료는 덮어쓰지 않는다. zirkott-tools.forWorld는 현재 설정에 따라 등록·기록·거래 스키마와 설명을 구성한다. module-bridge와 검사도 현재 세계에 맞는 protocol(world)을 사용한다. 상인 관리 OFF의 거래는 물품만 준비하여 기존 Zp·수량·수납을 정산하며, ON은 기존 재고·상인·세력 경로를 사용한다. 항복 살해의 자동 카르마와 동료 거부 확인도 같은 토글을 따른다.

지역·은신처·중복 생존 메뉴를 없애되 저장 자료는 남긴다. 창고 접근은 교전 밖 수납 이동으로 단순화하고 은신처 방문 호출은 도구 목록에서 제외한다. 공개 도구 이름·IPC·세이브 네임스페이스·카드 배치·전투 계산은 유지한다. 실제 호스트와 모바일 검증은 수행하지 않았다. [변경과 범위](nyoru-release-0.28.2.md).

## 0.28.1 지르코트 생존 선택

zirkott-survival은 생존 모드·네 생활 수치의 읽기·시간 변화·소모품 회복을 맡는다. 신규 세계에는 명시적 survival:false를 저장하고, 이전 저장의 누락 값은 ON으로 읽는다. food/water 저장은 유지하고 view에서 hunger/thirst로 환산한다. hygiene와 새 변화량 설정은 이전 백업에서 선택 필드이며 읽기 기본값을 제공한다. OFF일 때 저장 수치를 건드리지 않고 방사선·출혈 계산은 zirkott-rules.advance에서 별도로 유지한다.

실제 시간은 tactical-combat.advance 한 경로로 전달된다. wash/rest는 지르코트 record의 eventId로 중복을 막고, 소모품은 기존 inventory 트랜잭션으로 소비한다. 조회와 API 대기, 토글 변경은 시간을 늘리지 않는다. 생존 고갈 피해는 임계점을 넘은 시간에만 적용한다. 위생은 경고와 회복을 제공하며 감염·사망의 별도 규칙을 추가하지 않는다.

zirkott-ui의 초기 설정과 현재 게임/구축 초안 토글은 기존 compiler와 관리자 저장을 사용한다. survival_settings는 모드와 기본값을 포함한 같은 편집 스냅샷을 뉴뉴에도 제공한다. tactical-ui·render·도구 sheet/summary는 동일 생존 view를 사용한다. 직접 편집은 기존 food/water 의미를 명시하고 아이템 효과와 인물 값의 라벨을 구분한다. 프로토콜은 검사에도 재사용한다. 다른 룰북·모듈·MCP/IPC·카드 식별자는 그대로다. [설정과 미확인 범위](nyoru-release-0.28.1.md).

## 0.28.0 지르코트

지르코트는 rulebook id zirkott, profile zirkott.v1인 독립 세이브다. runtime family tactical로 기존 전투·컴파일 저장 절차를 재사용한다. compiler의 tactical-v1 pipeline에 실제 rulebookId와 zirkottSetup을 보관하고, 같은 룰북의 이전 상태는 tactical-rules.merge로 보존한다. 다른 룰북을 자동 변환하지 않는다.

zirkott-data는 사용자 제공 카드의 지역·연결과 선택한 보스 설명을 참조 데이터로 가진다. 실행 스크립트·이미지·서술 지침은 포함하지 않는다. zirkott-rules는 부위 HP·시간에 따른 생존/피폭·물리 탄창·차폐·수납을 계산한다. tactical-combat의 해당 룰북 분기에서만 HP 피해·치료·재장전·시간 계산을 연결한다. 일반 택티컬의 HP 없는 부상 모델은 유지한다.

zirkott-engine은 지역 이동, 유한 수색과 시신 회수, 탄창 조작, 상인 거래, 세력 기록, 은신처와 관리 편집을 맡는다. 실제 수색 결과와 남은 수량을 저장하며 조회는 재굴림하지 않는다. 탄창과 부착물의 소유·연결을 물품 이동에 함께 반영한다. 창고는 휴대 상태와 별개이고 바닥 물품은 내려놓은 지역·지점에 묶는다. 등록된 NPC는 지정된 동행자가 아니면 지역 이동에 자동 합류하지 않는다.

zirkott-assistant와 tactical-assistant는 처음 등장한 인물/상인/장소만 보조 AI로 준비한다. 저장된 보스·지역·상품 정의를 재사용한다. 원본 보스의 거주지는 참조 정보이며 현재 등장 위치를 강제하지 않는다. 새 인물 로어 검색은 기존 actor-lore-search 경로를 사용한다. 지침은 별도 zirkott-prompts로 제공하고 HP·탄창·수색을 명시하되 이야기 진행·귀환·길이를 정하지 않는다.

zirkott-ui와 tactical-ui가 초기 지역·장비 선택, 전용 탭, 초안/실제 편집, 뉴뉴의 같은 필드 목록을 공유한다. mini-ui·render는 저장된 부위 HP·Zp·피폭을 읽는다. turn-review는 새 판정과 이미 계산한 행동·시간을 구분하고 review-confirmation은 부위 HP·생존값 감소 확인을 이어받는다. tactical-validation 뒤 zirkott-validation으로 저장 연결을 검사하며 backup의 외부 룰북 검증에 그대로 연결한다. MCP/IPC 이름, 저장 namespace, 모듈 v1과 카드 배치 방식은 바꾸지 않는다.

실제 호스트·모델·가상 전투 실행은 하지 않았다. [구현 범위와 로컬 배포 안내](nyoru-release-0.28.0.md)를 따른다.


## 0.27.1 신규 인물 자료 검색

actor-lore-search는 RisuHost.sources의 현재 채팅 범위를 재사용해 로어북 제목·키워드·본문의 이름을 검색한다. 초기 선택 자료는 그대로 보존하고 미선택 관련 로어만 제한된 수·크기로 추가한다. 전역 인물 인덱스나 임베딩 API를 만들지 않으며, 한 준비 요청의 session 안에서 자료 목록을 공유한다. 검색 단계에서 원문 조건·매크로·도구를 실행하지 않는다.

native-assistant(D100/헌터), social-assistant(로판/미연시), erencha-assistant, murim-assistant, tactical-assistant의 처음 인물 생성에 연결한다. 이미 있는 인물·몬스터 원형과 내장 자료의 우선 경로는 유지한다. native의 명시적 원문 갱신도 같은 검색 자료를 사용해 신규 등록의 sourceHash와 일관되게 비교한다. 초기 compiler.snapshot과 meta.sourceIds의 사용자 선택은 수정하지 않는다. 구형 비-native EncounterBuilder의 엄격한 원문 검증 경로는 이번 변경 대상이 아니다.

검색 결과는 생성 입력 loreSearch로 전달한다. 이름이 다른 사람의 설명에 언급된 것과 실제 주제 인물을 구분하도록 지시하고 sourceAmbiguous 응답을 ACTOR_LORE_AMBIGUOUS로 반환한다. 준비 캐시에는 검색 원문을 보관하되 호스트 진단 actorLoreSearch에는 제목·ID·발췌 여부·수량만 남긴다. 기존 MCP 인수·주사위·상태 적용·콜백·카드 식별자를 바꾸지 않는다. [0.27.1 안내](nyoru-release-0.27.1.md)에 사용 범위와 미검증 사항을 기록한다.

## 0.27.0 택티컬

tactical-rules와 tactical-validation은 전용 인물·부상·무기·파츠·숙련·관계·미터 전장의 저장 계약을 제공한다. resources는 빈 객체이며 HP 엔진을 호출하지 않는다. rulebook-runtime과 backup은 meta.rulebook.id가 tactical일 때만 이 검증·실행을 사용한다. 기존 여섯 룰북의 형식과 연결 식별자는 유지한다.

tactical-assistant는 처음 필요한 인물·기술·물품·지역을 준비하고 저장 정의를 우선 재사용한다. compiler의 tactical-v1 작업은 중간 응답과 최종 후보를 보관하고 기존 복구 화면에서 수정할 수 있다. 같은 룰북 재구축은 기존 인물과 전투·성장을 보존하며 초안 편집은 현재 게임을 바꾸지 않는다. 취소와 채팅 전원 OFF는 보조 준비 요청을 중단한다.

tactical-combat은 미터 위치·사선 엄폐·부위 판정·탄약·준비·장전·논리 시간을 처리한다. gauge는 소수점 준비 시각, round는 d100 선공, free는 명시한 행동만 사용한다. 실제 API 대기 시간으로 충전하지 않는다. 개별 선언의 실행 여부와 성공·실패를 결과에 보존하며 먼저 처리한 NPC 행동이 있으면 이후 미실행 이유를 함께 반환한다. 결과를 성공으로 뭉쳐 검사 후속 보상이 진행되지 않도록 구분한다.

tactical-engine은 소지·장착·호환 파츠·경제·윤리 사건·탐험과 관리자 편집을 연결한다. 사건 ID로 카르마 중복 적용을 방지하고 지정된 목격자의 관계만 변경한다. tactical-tools는 기존 다섯 MCP 이름을 사용하며 공개 스키마와 실제 실행 검증이 같은 catalog를 공유한다. Provider Manager 연결·콜백 대기·재호출 방식은 추가하지 않는다.

tactical-ui는 전체 화면·초안·뉴뉴 제안의 편집 필드를 공유한다. 기존 render와 mini-ui가 부상·무기·논리 시간의 전용 표시를 선택한다. review-actions·turn-review는 HP·네 거리 대신 전용 상태와 도구 형식을 전달한다. 줄어드는 값의 확인과 저장 결과 재사용은 기존 검사 흐름을 사용한다. 소스 수정·로컬 배포 생성 범위이며 테스트·실제 호스트와 모델 확인은 아직 수행하지 않았다. 사용 범위와 제한은 [0.27.0 안내](nyoru-release-0.27.0.md)에 기록한다.

## 0.26.0 구축·연결·선택 모드

murim-stats는 기계적인 참조만 무림 키로 정리한다. native-assistant.ability의 선택적 statModel로 무림 기술을 생성하며 backup.validateWorld와 rulebook-runtime의 준비/적용/관리자 입구에서 기존 참조를 이어받는다. 백업 가져오기는 원본 체크섬을 먼저 확인한 다음 복제본을 변환한다. movement는 actor 정의와 runtime actorState에서 같은 선택 스키마를 사용한다.

play-options는 combatOptions의 선택적 필드를 공유한다. compiler job.initialOptions를 구축 단계와 최종 적용까지 보관하며 탐험 OFF는 runtime 준비 이전·적용과 도구 목록/상태 안내에 반영한다. 지도 데이터는 삭제하지 않는다. equipment-slots는 의미상 확실한 장비 부위를 우선하고 명시된 자유 장착은 보존한다.

provider-tool-ipc-ui는 전역 연결 ON/OFF·timeout을 즉시 저장한다. provider-tool-ipc.start의 주기적 등록 확인과 30초 실패 유예는 기존 시작/채팅/전원/룰북 갱신에 더해 PM 준비 지연을 복구한다. 활성 게임 호출 동안은 주기 등록을 미루며 dispose에서 타이머를 해제한다. 새 재호출 프로토콜이나 게임 자동 재실행은 없다.

recovery-ui는 마지막 UI 오류와 compiler job의 실패 정보를 표시하고 보관 초안/중간 JSON을 수정한다. compiler.repairSavedDraft는 현재 채팅·미적용 초안만 허용한다. 최종 candidate는 기존 검증을 거쳐 ready 상태로 만들고 불완전한 단계는 실패 상태와 자료를 보존한다. 뉴뉴 setup_repair 제안도 먼저 편집 화면으로 연결된다.

review-confirmation은 Repository 후보 세계와 이전 세계를 비교해 감소가 있으면 채팅별 review-confirm에 변경과 결과를 보관한다. 원래 게임 트랜잭션에는 REVIEW_CONFIRMATION으로 미적용 결과를 남긴다. review-issues의 사용자 적용은 보관한 patch의 전제값이 그대로일 때만 실행하며 난수·AI 준비를 반복하지 않는다. 관련 상태 충돌은 수동 편집으로 남긴다. 결과 삭제는 목록의 tombstone으로 중복 수집을 막으며 거래 기록은 지우지 않는다.

hunter-reality는 정산 감액과 신규 전리품 확률을 적용한다. adventure의 강행은 원시 스탯 VS 고정 저항을 비교하고 정상 도구 사용은 보유·적합성을 확인한다. reality 지도는 끊어진 구역에 자동 우회 연결을 추가하지 않는다. 기존 맵·전리품 영수증은 유지한다.

erencha-reality는 meta.erencha.reality에 이야기 시간·원화·생활 수치·비용 설정을 보관한다. clock 기록과 real_life는 동일 시간 누적 함수를 사용한다. 일반 상태에는 원화·경고만 제공하고 숨겨진 값 편집은 Nyunyu real_life 제안과 real_life_edit 관리자 명령으로 연결한다. 현실 사망은 사용자 행동 전에 검사하며 건강·피로는 명중 보정에 연결한다. erencha-proficiency.needed는 hard 옵션일 때 요구량만 3배로 계산한다. 새 adventure 작성은 hard 옵션에 따라 적대 이용자 구역을 요청한다.

연결 모듈·저장 namespace·MCP 이름·기존 카드 배치·beforeRequest 대기는 유지한다. 로컬 배포 생성만 수행하며 실제 Risu/API·별도 최종 검수는 하지 않는다.

## 0.25.5 행동 시간과 준비 순서

action-gauge.consume는 일반 행동을 마무리할 때 행동 시작 속도로 산출한 10/rate 논리 시간을 진행하며, 행동자 외의 살아 있는 참가자를 충전한다. 시간 효과 시각에서는 기존 effect-system.combatTime을 실행하고 각 엔진의 전투 종료/사망 처리를 연결한다. select는 실제 readyAt이 이른 인물을 고르고 정확한 동률에만 참가 순서를 사용한다. 아무도 준비되지 않았으면 기존처럼 다음 충전 완료나 시간 효과 시각으로 이동한다. 실시간 타이머·별도 충전 호출·라운드별 일괄 충전은 없다.

combat.gauge.readyAt/currentAction은 선택 필드이며 공통 backup 스키마와 Gauge.validate에 연결한다. 구형 전투의 저장 값은 유지하고 읽기 snapshot은 새 필드를 저장하지 않는다. 현재 행동의 속도는 select에서 잡고 다음 일반 행동 종료에 사용하므로 자기 행동 중 버프로 해당 행동의 소요를 소급 변경하지 않는다. 연계/반격/기존 추가 행동은 별도 일반 행동 소비를 추가하지 않는다.

에렌샤 actionSpeed는 기존 기본값 10을 보존하는 인물 속도다. 생성, 같은 몬스터 자료 재사용, actorEditValue를 공유하는 인물 UI/뉴뉴/관리자 저장과 game-editor의 actor_state, 상태 응답에 연결한다. action-gauge.inputs의 BASE는 이 값에 기존 이동 숙련도 보정을 적용하며 SPEED 변수로 기본값도 노출한다. 몬스터에게 사용자 숙련도나 DND 스탯을 만들지 않는다. 이전 사용자 편집과 재구축 성장 보존은 유지한다. 전체/미니/카드는 기존 Gauge.html에서 전투 시간과 속도 수치로 표시한다. 실제 Risu와 전투 테스트는 수행하지 않았다.

## 0.25.4 선택 대기와 서술 분량

공통 narrative-flow는 봇의 분량·문체와 저장된 판정의 역할을 구분한다. effect-presets의 계산 묶음·전투 종료를 서술 중단으로 묶던 지침을 제거하고 미확정 기계적 결과 금지로 범위를 좁혔다. module-guidance/erencha-prompts의 소설 모드 중단 표현도 다음 미선택 행동의 대기로 정리했다. gameplay/erencha-engine의 대기 문구는 같은 Narrative.WAIT를 사용하되 awaitUser의 계산 조건은 바꾸지 않는다. 탐험도 한 구역·한 호출을 한 답변 한도로 취급하지 않는다. 요청 끝 안내·뉴뉴·설정 도움말을 연결했으며 저장·MCP 완료·IPC·카드 배치·토글 값은 유지한다. 실제 모델의 분량 준수는 미확인이다.


## 0.25.3 호출·전투 연결

actor-reference.instance는 정확한 저장 ID를 우선하고 진행 중인 동일 이름의 적을 새 키로 만들려면 실제 새 등장인 newInstance를 요구한다. gameplay의 중복 이름 참가자는 기존 전투 ID에 연결하며 후속 행동 ID로 새 개체 키를 만들지 않는다. native-assistant와 erencha-assistant가 같은 원칙을 따른다. 정상 증원과 서로 다른 몬스터는 보존한다.

gameplay와 erencha-engine은 일반 호출에서 미선택 사용자 행동을 자동 선택하지 않으며 NPC 자동 턴은 유지한다. combat-options.batch만 위임된 사용자 행동을 묶는다. tool-result-view는 저장 후 전달본에서 같은 지침 문자열과 과거 목록만 줄이며 저장 원본·카드 표식·실제 수치를 바꾸지 않는다. tool-runtime은 roster 변경과 responseChars를 진단에 추가한다. PM IPC 연결·타임아웃·저장 트랜잭션 식별자는 바꾸지 않는다.

skill-casting은 meta.skillCasting에 고정 기술·대상·남은 자기 차례를 저장한다. 시작/대기 행동은 비용·명중을 실행하지 않고 발동 시 각 엔진의 기존 비용·명중·효과·연계 경로를 사용한다. 즉시 반응/연계에서 시전 대기를 우회하지 않는다. combat-tactics는 준비된 강공격과 현재 HP·거리·방어 기술을 보고 방어/후퇴를 선택하며 같은 방어·후퇴만 반복하지 않는다. native의 준비 방어는 meta.preparedDefense에 저장해 다음 자기 턴까지 적용하고 반응 방어와 중복 합산하지 않는다.

combat-options.scaleEnemies는 등록 시점부터 적의 현재/최대 HP에 한 번만 감소 효과를 적용하고 원래 최대 HP는 보존한다. combat 종료 경로는 참가자 쿨다운·시전·준비 방어를 초기화한다. 사용 횟수와 자원은 그대로다. effect-model의 castTurns는 공통 편집·구축·뉴뉴·상태/미니보드에 전달된다. 실제 호스트 실행과 별도 최종 검사는 수행하지 않았다. 이번 버전은 로컬 배포만 허용되었다.


## 0.25.2 Provider Manager IPC와 알림

provider-tool-ipc는 선택적 직접 연결이며 app의 기존 callSerialized/tool-runtime/Repository를 사용한다. provider-tool-schema는 PM의 제한된 입력 프로필로 변환하고 엔진 앞에서 원래 값으로 복원한다. 직접 연결 토큰·현재 채팅·전원·룰북을 검사하며 공개 MCP는 그대로 유지한다. 취소 signal은 rulebook-runtime과 각 준비기/Provider에 전달하고 적용 직전 다시 확인한다. 저장된 결과는 취소하지 않는다. 등록만 최대 10초 재전송하며 게임 호출의 processing/재호출 프로토콜은 없다.

review-notifications의 HTML 생성 자식과 선택자는 Risu sanitizer가 유지하는 x-risu- 접두사를 공유한다. MAIN_DOM_PERMISSION만 권한 안내로 분류하고 요소 생성 오류는 별도 코드로 기록한다. 참고한 공식 SafeElement/공유 정제 훅과 확인 범위는 0.25.2 배포 문서에 남겼다.


## 0.25.2 게임 상태 없는 창 표시

`app.inspect()`는 적용된 게임·진행 중 거래가 없으면 `state:null`을 반환한다. UI의 플레이 화면은 이 상태에서 룰북별 계산·편집으로 진입하지 않고 준비·복구 안내를 표시한다. 읽기 오류는 기존 feedback에 남기며 안내 표시가 저장소를 초기화하거나 전원을 변경하지 않는다. `action-gauge.active/snapshot`과 `combat-range.snapshot`은 세계가 없는 읽기 호출을 각각 비활성·표시 없음으로 처리한다. 실제 전투 실행·저장 검증·MCP 미구축 오류는 기존대로 유지한다.

`UI.refresh/openMini`는 읽기 시작과 결과의 scope 및 표시 직전 현재 채팅을 확인한다. 읽기 실패는 loadError로 보관하고 renderUnavailable에서 원래 오류·다시 읽기·닫기만 표시해 불완전한 info로 설정·편집 바인딩을 진행하지 않는다. native-ui의 투자·장비 공통 실행기는 버튼을 만든 시점의 expectedScope를 adminExecute에 전달한다. mini-ui의 닫기는 reviewNotices의 panelVisible도 해제하여 미해결 채팅 알림을 다시 표시할 수 있게 한다.

## 0.25.1 오류 반환 경로

review-issues는 보고서의 선택 필드를 명시적으로 빈 값으로 바꾸어 지문을 만들며 JSON 저장의 엄격성은 유지한다. 도움 목록 버전4는 현재 채팅의 마지막 보고서를 한 번 수집한다. 이미 존재하는 ID의 초안·정리 상태·실행 결과는 덮어쓰지 않는다. API 요청·주사위·수리를 재실행하는 마이그레이션이 아니다.

review-actions의 소비 사전 확인은 effect-system.entity와 effectObjects를 사용한다. 에렌샤 inventory.use의 단일 target도 저장된 물체를 확인한 뒤 인물 준비로 넘어가며 직접 호출과 검사 적용에 같은 대상을 전달한다. give는 계속 인물 대상으로 제한한다. erencha-tools의 repair amount는 number이고 실제 비용·내구도 계산은 기존 durability.repair를 사용한다.

util.resultError는 error 문자열/객체와 최상위 code를 함께 읽어 직접 편집·미해결 적용에서 원인을 보존한다. 정상 판정 실패·자원 부족·잘못된 대상·분기 충돌을 성공으로 바꾸지 않는다. adventure는 비어 있는 세계관 지침도 장소 준비 키로 저장하고 구역·적·접근법 응답 오류를 구체적으로 반환한다. MCP 식별자·실제 완료 대기·주사위 영수증·카드 배치는 변경하지 않는다.

## 0.25.0 거리·장비·검사

combat-range가 전투의 위치·사거리·거리별 보정·이동력을 계산한다. d100/헌터/무림과 에렌샤 엔진은 같은 거리 계산을 사용하고 각자의 명중·비용·자동 행동·턴 종료를 유지한다. 기술 mechanics.range와 네 거리 효과는 effect-model/effect-editor-ui에 포함된다. combat-range-ui는 편집·전투 옵션·전체/미니 표시를 제공한다. 새 전투의 distance는 시작 위치에만 적용하며 기존 전투를 다시 배치하지 않는다.

equipment-presence가 소유·내구도·착용 조건을 한 번 계산해 기존 보정과 조합 효과에 공급한다. 소지와 착용 추가 행을 분리하며 기존 행은 equipped를 기본으로 읽는다. enhancement는 강화 한 번의 비용·판정·결과와 현재 가치를 공통으로 계산하고 enhancement-ui가 기존 관리자 저장 경로에 연결한다. 기본 가격은 유지하고 판매·경매·수리는 현재 가치를 사용한다.

검사 화면은 review 카테고리로 분리한다. turn-review 계획의 notes는 설명, issues는 사용자 수정이 필요한 구체적인 미해결 사항이다. review-report는 구형 안내를 보수적으로 분류하고 실행 오류의 단계·코드·문구를 표시한다. review-issues는 기존 초안·결과·정리 내역을 보존하면서 정보성 안내만 도움 목록에서 제외한다. person-input은 실제 도구 스키마에서 선택인 신원 필드의 빈 값만 정규화하고 나머지는 엄격 검사를 유지한다. adventure.prepare는 장치 없는 출구의 오류 문구를 읽을 때 null을 역참조하지 않는다. 상세 범위는 [0.25.0 안내](nyoru-release-0.25.0.md)에 기록한다.


review-notifications는 Risu SafeDocument로 메인 body에 독립 플로팅 루트를 붙이고 표시 완료 후에만 요소 참조를 보관한다. 실패 시 부분 생성과 리스너를 해제하며 입력창 측정은 부가 처리로 분리한다. ui의 열기/닫기가 플로팅 가시성을 전환하고 검사 설정 저장/미리보기에서 권한을 준비한다. 참고는 사용자가 제공한 유미 프로바이더의 플로팅 구조와 [공식 SafeElement 구현](https://github.com/kwaroran/Risuai/blob/main/src/ts/plugins/apiV3/v3.svelte.ts)이며 제품 코드는 자체 작성했다. 실제 호스트 표시·권한은 실사용 확인이 필요하다.

## 0.24.1 미해결 검사와 화면 알림

`turn-review`는 보완 계획·실패 코드·원래 답변 해시와 저장 분기를 보존한다. `review-issues`는 채팅 키의 `/review-help`에 미해결 항목·입력 초안·적용 시도·확인 기록을 별도로 저장한다. 검사 결과의 실패 판정과 실행 전 오류를 구분하며, 개별 입력 수정은 기존 `rulebook-runtime.prepare/apply`와 Repository의 별도 수동 트랜잭션으로 처리한다. 저장된 시도는 결과를 이어받고 다시 굴리지 않는다. 사용자 적용 결과는 다음 요청의 상태와 이미 적용된 변경 문맥에 전달한다. 카드 배치·MCP 완료·재호출 방식은 그대로다.

`review-issues-ui`는 저장·복구/AI 연결/알림에서 동일한 미해결 화면으로 연결한다. 현재 룰북 스키마로 입력칸을 만들고 인물·물품 선택과 선행 작업을 표시한다. `review-notifications`는 Risu V3의 `getRootDocument`/SafeElement API만으로 소유 DOM과 이벤트를 관리한다. 메인 화면 권한 거절은 UI에 남기며 게임 판정을 차단하지 않는다. 일부 V3에서 클릭 리스너가 문서에 연결되는 동작을 고려해 자기 버튼 영역·키보드 포커스만 처리한다. 채팅 변경·전원 OFF·플러그인 종료 시 알림을 숨기거나 제거한다. 시작 알림과 미해결 알림 설정은 분리하며 저장소 전체를 매초 조회하지 않는다.

## 0.24.0 채팅 전원과 시작 안내

`chat-power.js`는 채팅 Repository 키 아래 `/power`에 OFF·setup·ON과 시작 안내 선택을 저장한다. 저장 게임이 있는 구형 채팅만 ON으로 초기화하며, 새 채팅은 OFF다. 모듈의 실제 활성 여부가 항상 추가 조건이다. 이 키는 게임 세계·백업·롤백에 포함하지 않는다. `reviewStart`는 명시적 가동 시점의 메시지 경계이며 OFF 중 서술의 직후 소급 검사를 막는다.

`app.js`는 OFF/setup에서 도구 목록을 비우고 소유한 모듈 지침·상태 문맥을 제거한 요청을 반환한다. 원래 봇 프롬프트·assistant/tool 내용과 서명은 수정하지 않는다. ON에서는 기존 룰북 목록과 일시적 읽기 실패 시 해당 채팅의 목록 캐시를 유지한다. `tool-runtime.js`는 호출 입구, 보조 준비 후, 상태 적용 직전에 전원을 확인한다. OFF는 준비용 요청을 중단하지만 이미 기록한 주사위를 지우거나 다시 굴리지 않는다. 출력에 따른 게임 확정은 ON에서만 실행하며 이미 저장된 카드의 읽기 표시는 유지한다.

`onboarding-ui.js`는 UI의 기존 자료 선택·룰북 구축·초안 편집·수정 요청·적용을 단계로 연결한다. `ui.js`에서 OFF/setup은 시작하기·AI 연결·저장 복구만 표시한다. 최종 적용은 기존 직렬 대기열을 사용하며 저장 후 사용자가 확인한 준비 상태에서만 ON으로 전환한다. 전원 OFF와 도중 취소를 최종 가동으로 덮어쓰지 않는다.

`backup.importBackup`의 `rebindScope:true`는 시작 안내의 명시적 확인에서만 사용한다. 원래 세계를 검증하고 체크섬을 확인한 뒤 복제본의 채팅 범위를 바꾸어 새 버전으로 저장한다. 다른 채팅의 답변/카드 연결은 복원하지 않는다. 일반 복원은 같은 채팅으로 제한하는 기존 계약을 유지한다. 연결 모듈 v1·MCP 식별자·게임 스키마는 그대로다. 실제 Risu와 호스트 목록 캐시의 갱신 시점은 이번에 실행 확인하지 않았다.

## 0.23.2 호출 조건과 장소 기록

`narrative-flow.js`는 서술 분량·문체·묘사 압축 대신 실행 계약만 제공한다. 일반 지침은 모듈의 기존 삽입 위치에 남고 요청 끝의 짧은 안내는 현재 기록과 이후 새 행동을 구분한다. `result-record.lastResults`의 조회는 새 행동을 막지 않는다. 전투 묶음의 계산 상한·자동 NPC·사용자 선택 경계는 그대로다.

`adventure.entryHint`는 공통 엔진과 에렌샤의 현재 상태에 `explorationEntry`를 제공한다. 활성 지도는 여전히 `exploration`이며, 비활성 상태를 가짜 지도로 바꾸지 않는다. 실제 구역 진입·이동은 에렌샤의 저장 위치도 갱신하고 날짜·시간·현실 상태를 임의로 바꾸지 않는다. `erencha-tools`의 선택적 `record eventType:clock` 필드는 `erencha-assistant`에서 직접 사건으로 준비해 기존 엔진의 기록 절차로 저장한다. 알려지지 않은 필드는 유지하며 자연어 기록 경로도 보존한다.

놓치지마 검사는 같은 입장·이동·일반 장소 기록 구분을 사용하며 이전 결과를 재연하지 않는다. `moduleGuidanceSelected`는 구형 모듈 지침 유지 여부와 삽입 성공만 기록한다. 별도 훅·재호출·출력 차단을 추가하지 않는다.

## 0.23.1 연결 보완

`actor-reference.js`는 현재 호출에서 준비한 참가자의 이름·instanceKey를 ID로 연결한 뒤 저장 명단을 조회한다. 명시적 ID, 현재 호출의 참가자, 생존 개체와 현재 전투 순으로 범위를 좁히며 여전히 동명이면 대상 구분 오류를 반환한다. 에렌샤와 공통 d100/헌터/무림의 준비 경로가 이를 사용한다. 별도 NPC 생성이나 현재 저장 인물 병합을 하지 않는다.

`erencha-roll.js`는 에렌샤 높은 눈 판정의 기본 대성공 96~100과 치명타 보정을 구분한다. 공격은 그 결과로 피해 배율과 카드 outcome을 함께 결정한다. `hit`에서 실제 실행이 없으면 일반 실패 판정으로 반환하지 않으며 전투의 요청 적용/턴 진행으로 넘기지 않는다. 검사도 actionExecuted:false를 이미 처리된 공격으로 보지 않는다.

0.23.1에서 `narrative-flow.js`를 도입했으며 0.23.2에서는 위 실행 계약으로 정리했다. 공통 탐험은 visible의 nextActions로 현재 보이는 출구와 후속 조작을 알리며 미래 사건을 자동 실행하지 않는다.

검사는 기존 beforeRequest의 직렬 await 안에서 끝내고 상태를 다시 읽는다. reviewRunStarted/reviewRunReturned는 검사 경계, requestStatePrepared는 보완 후 상태 준비, beforeRequestReturned는 플러그인 훅 반환이다. afterRequest/outputReceived의 reviewInProgress는 실제 출력 이벤트와 검사 작업이 겹쳤는지를 기록할 뿐, 첫 토큰 시점·호스트 요청 전송·외부 타임아웃을 추정하지 않는다. 카드 확정·재호출 프로토콜은 그대로 유지한다.

## 0.22.8 연결 정비

- `erencha-defense`는 누락된 기본 방어·회피만 보완하고, 저장 기술의 위력·MP·횟수·숙련도·효과로 태세를 계산한다. 기존에 편집한 기술은 덮어쓰지 않는다. 다음 자기 차례에 태세를 해제한다.
- `erencha-quests`가 수락·진행·완료와 약속한 보상을 관리한다. 완료 사실이 명시되어야 지급하며 한 번 지급된 보상은 반복하지 않는다. 사건의 중복 표식은 퀘스트 ID·작업·진행 내용으로 구분한다. `recordedQuests`에 진행과 보상 내용을 실어 메인 AI에 전달하며 전용 입력은 보조 해석 없이 저장한다.
- `nyunyu-capabilities`는 실제 편집 스키마를 지식으로 제공한다. `skill-authoring`/`item-authoring`과 기존 편집기, `game-editor`/`game-editor-ui`가 새 항목과 수정 제안을 미리 보여 주고 관리자 Repository 경로로 저장한다. 기술 정의뿐 아니라 소유자의 숙련 상태·무림 성수도 다룬다. 과거 판정·지급 이력과 인증 정보는 뉴뉴의 편집 대상이 아니다.
- `item-stacking`은 효과·회복·품질까지 같은 소모품만 합친다. `durability`는 실제 소유·착용 장비만 다루며 파괴된 장비는 명중 시 효과도 중단한다. 연계 기술은 실제 행동자의 소유 기술로 해결한다. 명령 연계에서 지휘자의 가짜 명중이나 동료 일반 턴 소비를 추가하지 않는다.
- `ai-connections.switchFormat`은 역할·형식별 편집 상태를 교체한다. `credentials`의 기존 현재 인증 키는 유지하며 형식별 설정은 그 아래 `:profiles:v1` 기기 저장소에 추가한다. 비밀 키/JSON은 동기화 설정·게임 백업에 넣지 않는다. `api-settings-ui.prepareSecrets`는 붙여넣은 JSON을 로컬 검증한 뒤 연결 저장/확인에 사용한다.
- 테마 CSS의 루트 선택자만 보완한다. 0.17.5 카드 배치, MCP 이름, 공개 도구 수, 호출 완료·재호출 프로토콜은 변경하지 않는다. 상세 증거와 한계는 [검사 기록](full-audit-0.22.8.md)을 참조한다.

## 0.22.7 에렌샤 전투 연결과 검사

`erencha-assistant`는 기술 이름의 일부 단어만으로 적/아군을 결정하지 않고 등록 기술의 종류·대상 정책을 함께 읽는다. 생략된 인물 kind를 무조건 ally로 덮어쓰지 않고 실제 몬스터/소환수/동료 해석을 보존한다. 기존 인물은 같은 ID와 편집 내용을 유지한다.

`erencha-engine.battleContext`가 현재 교전의 임시 편과 전투 진입을 계산한다. `combat:true`는 비전투 단일 판정 분기보다 우선하며, 지정한 opponents는 영구 인물 종류를 바꾸지 않고 전투 편에 반영한다. `start`·후속 합류·자동 턴은 같은 임시 편을 사용한다. 대련의 상대를 지휘관 모드에서 아군으로 오인하지 않도록 `combat-options.controlled`도 현재 전투 편을 따른다. 짧은 전투 관찰 등의 task는 자기 차례를 소비하며, 제작·채집·장시간 작업은 기존처럼 전투 중 실행하지 않는다. 전투 상태 요약에는 저장된 combatOptions를 전달한다. MCP 이름·저장 식별자·카드 배치·콜백 대기는 변경하지 않는다.

`review-actions.combatState`는 옵션·참가자·현재 차례·사용자 대기·미결 반응을 검사 AI에 전달한다. `COMBAT_FLOW_MISSING`과 `NPC_TURN_PENDING`은 서술과 대조할 후보이며 자동 재굴림 사유가 아니다. 검사 AI는 실제 등장 인물을 먼저 등록하고, 아직 진행 중인 교전의 연결 보완을 `combatRepair:true`와 기존 `rpg_play.act`의 관전/participants로 제안한다. 프로그램은 한 검사에 한 번만 허용하고 살아 있는 양쪽 참가자와 지원 룰북을 확인한다. 실행 시 playerActions를 부여하지 않으며 이미 처리한 공격·과거 반격을 재연하지 않는다. 정해진 사용자 턴·지휘관 선택·미결 반응은 정상 대기로 보존한다. 검사 기능은 기존 선택 옵션 안에서만 동작한다.

## 0.22.5 저장소 정리

`storage-manager.js`는 현재 Repository namespace 아래 정확한 채팅 해시별 키와 같은 해시의 `urpg/source-prompts/`만 묶는다. 목록을 열 때 키 목록과 대표 상태·초안을 읽고, Risu의 이름 목록 및 `/storage-label`로 채팅을 구별한다. 정상 플레이나 매 UI 갱신에서 전체 저장소를 훑지 않는다. `storage-ui.js`는 저장·복구에 검색·여러 채팅 선택·백업·삭제 범위 확인을 제공한다. 삭제는 MCP에 공개하지 않는다.

초안 정리는 `job/*`와 `current-job`만 삭제한다. 채팅 데이터 전체 정리는 해당 해시의 게임 버전·거래·카드 바인딩·초안·준비 캐시·테마·저장 원문을 삭제한다. 전역 API 설정·기기 인증·규칙 라이브러리·효과 세팅·모듈 전환 원본은 건드리지 않는다. 사용자 삭제 요청은 App 직렬 대기열과 Repository 잠금 안에서 처리하고 확인 때의 키·head·current-job이 바뀌었으면 멈춘다. 삭제 중 포인터부터 제거하고 일부 I/O 실패를 완료로 보고하지 않는다. 같은 채팅의 진행 중인 임시 답변은 먼저 완료/폐기해야 한다. 다른 창·기기의 동시 사용까지 원자적으로 보장하는 저장소는 아니다.

`DiagnosticJournal.prune`은 기존 flush 대기열에서 파일 페이지와 메모리 페이지·미저장 목록을 함께 걸러 다음 flush가 삭제한 로그를 다시 쓰지 않게 한다. 채팅 삭제 시 정확히 연결된 진단만 제거하고, 전체 진단 정리는 진단 namespace만 지운다. 채팅 연결이 없는 전역 이벤트는 개별 채팅 삭제로 추정 제거하지 않는다. UI·표시·프롬프트의 해당 메모리 참조도 정리한다. Risu 채팅 원문은 변경하지 않으므로 삭제한 저장에 대응하는 과거 카드 표식이 원문에 남을 수 있다.

## 0.22.0 연결 모듈

`module-bridge.js`가 실제 활성 모듈과 현재 채팅의 설정을 읽습니다. `module-settings.inject`는 기존 depth 0 시스템 로어 위치의 연결 표식을 `module-guidance`의 선택 룰북으로 채웁니다. 구형 모듈이 활성인 동안은 그 렌더링된 원문을 유지하고 중복만 제거합니다. 상태 문맥의 위치와 assistant/tool 메시지·서명은 유지합니다. 모듈이 꺼진 채팅에는 지침/상태·MCP 게임 작업·출력 저장·카드를 적용하지 않습니다. 0.24.0부터 사용자가 요청한 채팅 전원과 모듈 활성 여부에 따라 도구 목록도 제어합니다.

`chat-presentation-ui.js`는 시스템 구축의 테마 예시·한 번의 모듈 전환·보관한 사용자 설정을 담당합니다. 0.22.4에서 별도 지침 룰북 선택을 제거했습니다. `module-bridge.protocol()`이 실제 저장 게임의 룰북을 읽어 기존 지침 위치에 넣습니다. 새 초안의 선택만으로 실행 중인 게임을 바꾸지 않으며, 사용자 수정 지침을 기본 지침으로 덮어쓰지도 않습니다. 테마 등 표현 설정은 별도 채팅 키에 보관합니다. 모듈 원본은 `urpg/module-bridge/v1/modules/<id>`에 보관하고 같은 ID로 변환합니다. 임의 배경 CSS/추가 로어·스크립트는 보존합니다. `card-themes.js`는 표시 결과에만 채팅 범위의 CSS를 추가합니다. `inline-placement.js`, 카드 바인딩과 도구 완료 흐름은 그대로입니다. `theme-data.js`와 `protocol.md`는 빌드 산출물입니다.

공식 RisuAI v3는 `parseRisuChat`을 공개하지 않으며 RPC Proxy에서는 존재하지 않는 메서드도 함수처럼 보입니다. 0.22.4는 그 호출을 제거하고 저장된 테마·현재 채팅의 `GLGlobalVariables`에서 기존 선택을 읽습니다. 공식 호스트에서 조회할 수 없는 전역 전용 토글은 추정하지 않습니다. 전환 전 모듈 원문을 보존하고 NyoruRPG의 고정 룰북/테마 CBS 분기만 로컬에서 선택합니다. 사용자 임의 CBS 전체를 해석하는 API를 대신 구현하지 않습니다. 자료 새로 읽기는 최근 요청에서 캡처한 프롬프트와 저장한 자료를 사용합니다. 카드 표시에서는 테마 처리 실패를 기본 카드 렌더링과 분리하여 이미 만든 HTML을 버리지 않습니다. 실제 저장 결과가 없는 표식을 가짜 카드로 만들지는 않습니다.

연결 모듈의 v1은 플러그인 버전과 독립적입니다. 향후 보통의 규칙·디자인 변경으로 `.risum` 본문이 바뀌지 않습니다. 모듈의 `@@mcp`, 깊이/순서 및 표식은 호스트 연결에 필요합니다. 전환과 한계는 [0.22.0 안내](nyoru-release-0.22.0.md)를 참고합니다. 아래 이전 구조 기록 중 모듈에서 지침을 선택한다는 부분은 전환 전 경로입니다.

수정 전 [잊으면 안 되는 사항](잊으면-안-되는-사항.md)의 사용자 결정과 금지할 변경을 확인합니다.

## 역할과 흐름

0.21.0은 0.20.2의 `processing`/`nextCall` 중간 응답과 메모리 Promise 캐시를 제거한다. `app.js` MCP 콜백은 기존 `callSerialized`가 반환한 실제 결과를 그대로 전달한다. 저장된 행동의 재전송 처리는 Repository가 맡는다. 외부 호스트 타임아웃이 해결됐다고 주장하지 않으며, 카드 표시·출력 훅은 변경하지 않는다.

RP가 장면과 행동을 정합니다. 처음 필요한 인물·기술·활동은 보조 AI가 준비하고 저장합니다. 이후 계산은 저장된 규칙으로 수행합니다. 도구가 이야기의 다음 단계나 사용자의 선택을 미리 정하지 않습니다.

```text
메인 AI가 실제 행동 또는 이미 일어난 사건을 전달
  → 저장된 룰북으로 도구 정의·검사 선택
  → 기존 호출 기록 확인
  → 필요한 인물·기술·해석 준비
  → 채팅·답변 경계 확인
  → Repository의 후보 상태에 룰북 계산 적용
  → 상태 검사와 호출 기록 저장
  → 결과·관련 인물 상태·카드 표식 반환
  → 메인 AI가 해당 결과를 서술
  → 답변 저장 확인 후 게임 상태 확정
```

## 책임별 위치

공통 d100·헌터의 `gameplay.js`는 한 번의 `act`로 턴 순서에 따른 앞선 NPC 행동, 요청 행동, 뒤따르는 아군·적 행동을 처리합니다. 연계·반응·비용·피해도 각 단계에 기록합니다. 사용자 선택·미결 반응·전투 종료에서 멈추며, NPC 반복은 호출 안에서 참가자 수만큼으로 제한합니다. 관전자는 참가하지 않고 `계속`·`관전`으로 실제 교전자의 턴들을 이어갑니다. 다음 NPC마다 메인 AI가 개별 공격을 호출해야 하는 구조로 바꾸지 않습니다.

앞선 NPC의 행동으로 전투가 끝났다면 요청 공격은 실행되지 않을 수 있습니다. `requestedActionApplied:false`는 요청 공격·기술에 대한 표시이며, `steps`에 기록된 다른 행동은 유효합니다. 메인 AI는 자동 처리된 단계까지 순서대로 서술하고 중복 호출하지 않습니다. `next`는 아직 남은 선택·반응·진행 지점입니다. `combat` 선택은 실제 비전투/교전 경로에 연결하고, 임시 적대 관계는 `combat.teams`에 보관하며 등록 인물의 kind를 덮어쓰지 않습니다.

조회·등록의 기술 수치는 `Engine.mechanicalSheet`/`skillNumbers`에서 현재 실행 정의로 계산합니다. `meta.native.actors[].skills`의 초기 작성 메모를 현재 비용으로 전달하지 않습니다. `result-record.responseActions`는 현재 답변의 호출 기록만 요약해 요청 문맥에 제공합니다.

공통 d100·헌터의 공개 도구는 7개이며, 숫자를 유지하는 것보다 필요한 기능의 연결이 우선입니다. `rpg_play.check`는 비전투 판정, `rpg_progress.award`는 완료한 사건의 경험치, `rpg_registry.train`은 저장된 훈련 성장 정책으로 연결합니다. `act.threatId`와 `reactions[].threatId`는 기존 공격에 대한 반응을 식별합니다. 소모품·재장전·소환으로 현재 행동을 소모하면 `tool-runtime`이 같은 인물의 `act 계속`을 안내합니다. 기존 명령별 대응과 한계는 [기능 연결 점검](mcp-route-audit-0.17.3.md)에 기록했습니다.

| 책임 | 파일 | 변경할 때의 기준 |
| --- | --- | --- |
| 호스트 연결·플러그인 수명·답변 이벤트 | `app.js`, `host.js`, `lifecycle.js` | Risu 원본 메시지와 서명은 유지 |
| 채팅 전원·처음 시작 안내 | `chat-power.js`, `onboarding-ui.js`, `ui.js` | 새 채팅 OFF, 확인 후 ON, 기존 세이브와 준비 내용 보존 |
| MCP 이름 | `mcp-identity.js` | 등록·해제·모듈 주소가 같은 상수를 사용 |
| 룰북 선택과 연결 | `rulebook-runtime.js` | 저장된 게임이 기준. 명세·검사·준비·엔진·상태창을 함께 연결 |
| 공통 실행 순서 | `tool-runtime.js` | 모든 변경은 같은 저장 경로. 자료 준비는 저장 잠금 밖 |
| 도구 동작 정의 | `common-tools.js`, `social-tools.js`, `erencha-tools.js` | 동작과 인수를 여기서 수정 |
| 공개 명세·검사 생성 | `tool-catalog.js` | 위 정의를 공유. 별도의 수작업 필수 인수 목록 금지 |
| 내부 호환 호출 | `contracts.js` | 기존 엔진·편집 호출이 같은 정의를 재사용 |
| 보조 AI 준비 | `native-assistant.js`, `social-assistant.js`, `erencha-assistant.js`, `encounter-builder.js` | 계획을 준비하며 현재 게임 상태에 직접 쓰지 않음 |
| 룰북 계산 | `engine.js`, `native-rpg.js`, `hunter-rpg.js`, `social-engine.js`, `erencha-engine.js`와 각 규칙 파일 | 비용·성장·반응·전투 등 각 룰북의 계산 보존 |
| 상태 저장과 호출 재시도 | `repository.js`, `backup.js` | 후보 상태 검사 후 반영. 불확실한 저장은 자동 재굴림 금지 |
| 사건 식별 | `event-identity.js` | 기존 사건 키 형식 유지. 효과 종류별 처리 기록 분리 |
| 결과 읽기 | `result-record.js` | 저장 결과의 공통 외형·하위 단계·최근 기록·관련 인물 추출 |
| 표시 | `render.js`, `inline-placement.js`, 각 상태창 파일 | 저장된 수치로 표시. 현재 HP에서 과거 피해를 역산하지 않음 |
| 수동 편집 알림 | `manual-changes.js` | 이미 적용된 장비 변경을 전달하고 중복 실행 방지 |
| 모듈 지침 | `module-guidance.js`, 각 룰북 프롬프트, `module-settings.js` | 사용자가 모듈에서 고른 지침을 사용. `protocol.md`는 빌드 산출물 |

공통 d100과 헌터는 공통 계산 구조를 공유하면서 헌터 고유 능력치·성장·상태창을 유지합니다. 로판·미연시는 사회 규칙 구조를 공유하며, 에렌샤는 별도 숙련도 엔진을 사용합니다. 예전 저장 세계도 기존 처리 경로를 유지합니다.

## 0.28.9 · 무림 새 인물과 탐험 연결

`murim-assistant.setupContext`는 초기 개인 요청의 대상과 새 인물 등록 대상을 분리한다. `assertIdentity`는 별도 개체를 기존 인물로 합친 응답과 다른 비적대 등록 인물의 이름·별칭을 빌린 새 인물 응답을 적용 전에 거부한다. 이름 없는 무공 유사성만으로 신원을 추정하지 않으며 기존 저장을 자동 수정하지 않는다. 신규 준비 캐시는 loreVersion 2를 사용하고 이전 응답·영수증을 삭제하지 않는다.

`adventure.prepareNative`는 같은 적 행(count)의 새 무림 준비 응답만 `reuseEncounter`로 이어받는다. 다른 개체·기술·물품 ID 참조가 있으면 재사용하지 않는다. 매 설치에서 독립된 인물·기술·장비 상태를 생성하며 기존 인물을 템플릿처럼 초기화하지 않는다. `visible.nextActions.combat`은 발견한 적의 ID와 실제 교전용 act 연결을 알려주는 조회 자료이며 자동 전투 명령이 아니다. `turn-review`는 탐험 영수증과 전투 영수증을 구분하고, 이미 끝난 서술과 저장된 적 상태의 실제 모순을 구체적인 미해결 사항으로 알리도록 한다.

`tool-runtime`의 `toolVerification` 이벤트는 기존 확인 작업을 감싼 시간 기록이다. chatPower/history/historyBeforeApply별 시작·완료·실패를 남기며 확인 생략·새 타이머·재호출은 추가하지 않는다. 기존 verify 전체 시간만으로 보조 API 지연이라고 판정하지 않는다.

## 호출과 사건의 차이

- `actionId`: 도구 호출 하나의 ID. 전송 재시도에는 같은 ID와 같은 인수를 사용합니다. 다른 후속 호출에는 새 ID가 필요합니다. Repository가 호출 단위 중복 실행을 막습니다.
- `eventId`: 이야기 속 사건의 ID. 같은 사건의 판정과 후속 기록은 이 ID를 공유합니다. 성장·회복·감정 등은 서로 다른 효과 기록을 사용합니다.
- `learning:인물:사건` 등 기존 키는 그대로입니다. 저장 데이터를 이사하거나 과거 보상 기록을 지우지 않습니다.
- 비용과 보상을 막는 조건은 각 규칙 엔진에 있습니다. 모든 후속 작업을 차단하는 전역 사건 완료 플래그를 추가하지 않습니다.

## 명세와 결과 형식

MCP 입력은 `op`를 가진 단순 객체입니다. 공개 스키마에는 해당 도구의 인수들을 합쳐 표시하고, 모든 동작에 공통인 필수 인수만 최상위 `required`에 둡니다. 동작별 필수 인수는 같은 정의에서 `op.description`으로 생성합니다. 실행 시에는 선택한 동작의 정확한 스키마로 검사합니다. 호스트의 복잡한 최상위 조건부 스키마 지원에 의존하지 않습니다.

0.18.2부터 필드를 합칠 때 사라지는 동작별 설명·허용값도 해당 필드의 설명에 남깁니다. 예를 들어 `rpg_play.act.action`은 자유 문장이지만 `explore.action`은 `start|move|inspect|investigate|interact|end`입니다. 탐험 시작에는 실제 장소 `name`, 이동에는 반환된 출구 `destination`을 안내합니다. 없는 탐험을 임의로 생성하거나 이동을 시작 호출로 바꾸지는 않습니다.

기존 호스트 진단에는 플러그인 버전과 `toolReceived`(플러그인에 도착), `toolStage`(처리 단계), `toolBlocked`(단계·오류 문장), `toolReturned`(함수 반환·처리/대기 시간)를 남깁니다. `callId`는 같은 `actionId`의 재전송도 구분하는 실행 중 일련번호입니다. `prepare`는 보조 AI를 사용할 수 있는 준비 단계이며 그 시간 전체가 API 지연이라는 뜻은 아닙니다. `toolReturned`는 플러그인 함수가 결과를 반환했다는 뜻이고 Risu 또는 메인 모델의 수신까지 입증하지 않습니다. 전체 인수·프롬프트·API 응답은 기록하지 않으며 오류 문장은 기존 인증정보 가림 처리를 거칩니다. 진단은 기존처럼 최근 200개 이벤트만 보관하므로 오래된 호출은 빠질 수 있습니다.

저장 결과의 공통 외형은 기존대로 `ok`, `logicalActionId`, `transactionId`, `generationId`, `profile`, `stateRevision`, `status`, `applied`, `persistence`, `roll`, `outcome`, `changes`, `result`입니다. 바깥 `changes`는 저장 영역의 변경 기록이고, `result` 안에는 각 룰북의 실제 수치·효과·하위 `steps`가 들어갑니다. 내부 수치 구조를 억지로 같은 모양으로 변환하지 않습니다.

`last_results.records`는 모든 룰북에서 `actionId`, `tool`, `op`, `status`, `outcome`, `roll`, `result`로 반환합니다. 이 조회는 주사위나 비용을 다시 처리하지 않습니다. `action_result`는 기존처럼 지정한 호출의 원래 저장 결과를 반환합니다.

카드 표식은 기존 `[NyoruRPG:번호]`를 유지합니다. 하위 단계의 경로와 번호를 유지하면서 결과 조회와 관련 인물 추출이 같은 저장 결과를 읽도록 정리했습니다.

0.18.8은 사용자 요청으로 출력 이벤트 처리와 카드 연결을 0.17.5 방식으로 복원합니다. 원래 호스트 출력 이벤트를 직렬 대기열에 전달하고 그 이벤트의 메시지와 저장 본문을 확인해 확정합니다. 도착 시점 정보는 진단에만 남기며 카드 연결을 차단하거나 고정하지 않습니다. 스트리밍 종료를 감시하는 추가 출력 재시도는 제거합니다. 0.18.3의 출력 알림 기반 `RESPONSE_FINISHED` 차단과 요청 훅 횟수 기반 실행 취소는 다시 넣지 않습니다. 답변 확정 뒤 같은 입력의 후속 도구는 현재 상태를 이어 쓰고, 동일 입력·행동 ID·인수의 재전송은 앞서 저장한 결과로 돌아갑니다.

`Repository.execute`는 선택적으로 저장이 끝난 거래를 반환용 객체에 전달합니다. `tool-runtime`은 상태를 다시 읽지 않고 이 거래로 실제 결과와 카드 참조를 조립합니다. 부가 상태 요약·상태창 오류는 저장된 실제 결과를 변경하지 않습니다. 알림·캐시 정리·진단 저장 완료는 MCP 응답의 필수 대기가 아닙니다.

도구 목록 조회는 진행 중인 거래 검사를 하지 않고 저장된 룰북을 사용합니다. 같은 채팅의 목록 캐시가 있으면 저장소 오류 시 그것을 유지합니다. **0.18.7부터 미확인·구축 전 상태에서도 실행 도구를 숨기지 않습니다.** 이때는 각 룰북의 공개 목록을 이름별로 합쳐 제공합니다. 동작과 인수 설명에는 해당 룰북을 남기며, 편집·구축 적용 등 비공개 관리자 동작을 새로 공개하지 않습니다. 실제 호출 검사·실행은 저장된 게임의 룰북이 담당합니다. 구형 `rpg_explore` 호출은 nativeRoute에서 통합 탐험 인수로 연결하되 원래 호출의 인수·행동 ID는 중복 실행 판별에 보존합니다. 새 탐험이 활성일 때 남아 있는 구형 탐험은 보관하고 활성 상태에서 내립니다.

표시 훅은 0.17.5와 같이 진행 중인 MCP 호출을 기다리지 않습니다. 카드 연결 전에는 현재 답변에 실제로 적힌 짧은 표식만 미리 표시하고, 누락 카드 보완은 저장된 최종 답변 연결 뒤 수행합니다. 최근 완료 거래를 별도 표시 캐시에 보관해 미완료 본문에 카드를 선삽입하던 경로는 제거했습니다. 채팅 원문·모델 서명은 변경하지 않습니다.

호스트 진단은 `host-diagnostics.js`가 플러그인 저장소의 `urpg/host-diagnostics/v1/` 아래 실행 세션·200개 페이지별로 누적합니다. 최근 200개 메모리 표시는 유지하지만 내보내기는 현재 채팅의 보관 기록을 포함합니다. 답변별 비교 요약은 명시된 트랜잭션 및 같은 실행 세션의 호출 ID로 구성하며, 연결 근거가 없는 호출은 다른 답변에 추정 배치하지 않습니다. 전체 인수·프롬프트·응답은 기록하지 않습니다.

카드 연결은 0.17.5의 본문 해시·메시지 ID 방식으로 복원했습니다. 0.18.3에서 추가한 `ownsResponse` 검사와 출력 수집 단계의 추가 제외 조건은 제거했습니다. `inline-placement.js`는 원래 0.17.5와 같으며 새 배치 알고리즘을 추가하지 않습니다. 이후 게임 기능에 필요한 회피·복합 속성·개별 행동·패배 결과의 카드 내용은 유지합니다. 과거 게임 수치를 소급 변경하거나 판정을 다시 굴리지 않습니다.

## 유지한 경계와 남은 한계

등장 인물 등록, 전투 참가, 대결 판정, 이미 일어난 사건 기록은 각각의 목적을 유지합니다. 대결이 없는 장면에서도 인물·관계와 실제 변화는 기록할 수 있습니다. UI 편집과 MCP 행동은 같은 Repository를 사용합니다.

초기 해석과 사회 사건의 의미 판단에는 보조 AI가 필요합니다. 기본 동작은 메인 AI가 전달한 행동을 계산합니다. 0.22.6의 놓치지마 검사는 직전 서술의 누락된 사건과 아직 실행하지 않은 마지막 행동을 기존 엔진으로 계산하여 저장합니다. 이미 기록한 판정·자동 NPC 단계는 재실행하지 않고, 과거 전투 전체를 재구성하거나 서술에 맞춰 저장 수치를 덮어쓰지 않습니다. 미해결 사항은 검사 보고서에 남기고 메인 AI에 보완 업무로 넘기지 않습니다.

### 0.22.6 · 행동 재시도와 사건 기록

- 새 행동의 실행·난수는 각 룰북 엔진이 담당하며, 동일 호출 재전송은 Repository가 담당합니다. 에렌샤의 `act`/생활 활동, 사회 룰북의 `act`/간단 전투에서 eventId로 이전 결과 전체를 반환하는 경로를 제거했습니다. 무림의 수련·탐구·가르침 이해·돌파·일반 판정도 새 시도로 처리합니다. 무림의 사건 기록·가르침 등록·전투 성장 보상은 기존 중복 방지를 유지합니다.
- eventId는 행동 하나와 후속 사실 기록을 연결합니다. 전투 전체·장면 전체를 같은 판정으로 취급하지 않습니다. 같은 전투의 다음 공격은 새로운 actionId/eventId를 사용합니다. 기존 저장 키와 과거 기록은 삭제·변환하지 않습니다.
- `review-actions.js`는 직전 답변의 실제 호출 인수와 하위 행동을 대조합니다. `turn-review.js`는 근거 문구가 있는 누락을 `app.call`로 직접 처리합니다. 검사 보완도 고정 actionId를 쓰며 같은 저장 절차를 거칩니다. 미실행 행동은 현재 저장 규칙으로 처음 계산하므로 서술의 성공 주장과 다른 결과가 나올 수 있습니다. 실패·대기 결과 뒤의 성공을 전제로 한 보완은 실행하지 않습니다.
- 같은 주사위 5회 이상과 이전 결과 재사용 표시는 검사 보고서의 findings로 남깁니다. 이것만으로 오류를 확정하거나 재굴림하지 않습니다. 호스트 진단에는 eventId, outcome, applied, 호출 재전송 여부, 하위 단계의 주사위가 추가됩니다. API 키·전체 프롬프트·전체 도구 인수는 추가로 수집하지 않습니다.

이번 확인은 코드와 배포 산출물 범위입니다. 실제 RisuAI·모델 호출이나 가상 플레이 검수는 실행하지 않았습니다.

## 0.19.0 전투 확장

`combat-features.js`는 소환 상태·자동 발동·후속 기술 참조·처분 정리를 공유합니다. 공통 엔진은 개별 타격과 대기 반응/연계 큐를 기존 턴 처리 안에서 해결하며, 에렌샤는 별도 명중·MP·숙련도 계산을 유지합니다. `effect-model.js`와 저장 검사에 새 선택 필드를 추가해 구형 저장도 읽습니다. `durability.js`는 실제 HP 피해에 따른 착용 장비 마모·보너스 중단·유료 수리와 수리 도구 효과를 처리합니다. `combat-feature-ui.js`를 초안과 플레이 중 기술·장비 편집에서 함께 사용합니다. 새 설정은 첫 준비 프롬프트와 공개 도구/모듈 설명에도 전달합니다. 카드 표시·출력 훅은 변경하지 않습니다.

## 무림 연결

`murim-tools`는 같은 7개 공개 도구에 무림의 수련/탐구/가르침/돌파/사건 기록과 비전 습득을 연결한다. `murim-assistant`가 인물·기술·비전을 준비하고 `murim-rules`가 공유 전투 형식으로 컴파일한다. `murim-growth`만 경지·깨달음·성수를 변경한다. 인물 EXP/레벨 지급은 연결하지 않는다. 공통 전투·효과·장비·탐험을 재사용하고 비전의 연계 목록은 기존 후속 행동 처리에 전달한다. `murim-ui`/`murim-skill-editor`가 초안과 플레이 편집을 연결하며, `murim-display`는 기존 카드 전달 흐름에 새 결과 내용만 제공한다. 재구축은 이전 수련·천재·가르침·숙련을 보존한다.

## 0.21.0 API와 편집 책임

- `ai-connections.js`는 기본/정밀 구축/검사용 설정을 선택한다. 구축만 정밀 연결을 쓰고, 평소 자료 준비와 뉴뉴는 기본 연결을 쓴다. 정밀·검사 연결의 기본 공유는 ON이다. `credentials.js`는 역할별 인증을 기기별 LocalPluginStorage에 저장한다.
- `provider.js`는 Vertex Express/API key와 프로젝트·리전/OAuth 토큰 방식을 지원한다. 0.22.2의 `vertex-auth.js`는 서비스 계정 JSON을 읽고 Web Crypto의 RS256 서명으로 Google 고정 토큰 서버에서 토큰을 발급한다. 비밀 키는 `credentials.js`의 기존 기기별 저장 키에 선택 필드로 보관하며 일반 설정·게임 백업·프롬프트에 넣지 않는다. 메모리 토큰은 만료 60초 전부터 다음 요청에서 갱신하고 같은 키의 동시 발급을 공유한다. 생성 요청 자체를 인증 실패 때문에 자동 재실행하지 않는다. 직접 입력한 OAuth 토큰은 자동 갱신 대상이 아니다.
- `turn-review.js`는 기본 OFF. 새 사용자 입력의 beforeRequest에서 이전 최종 서술·저장 상태·실행 기록을 검사한다. 현재 입력은 아직 실행하지 않는다. 자료는 지시가 아닌 근거로 사용한다. 한 번 준비한 보완 계획과 고정 actionId/eventId로 재시도하며 기존 Repository를 거친다. beforeRequest가 이미 직렬 대기열 안이므로 다시 callSerialized로 들어가지 않는다.
- 검사는 등록·실제 사건/소지품 기록을 보완하고 불일치는 다음 메인 AI 문맥에 전달한다. 이미 계산한 판정·비용·보상 재실행 및 미실행 전투의 소급 결과 생성은 허용하지 않는다. 보완 요청의 의미 판단에는 모델 오류 가능성이 남는다. 같은 답변의 검사 실패를 자동으로 반복 청구하지 않는다. 다른 플러그인 훅보다 먼저 실행됨은 보장하지 않는다.
- `nyunyu.js`는 현재 채팅 범위의 메모리 대화만 유지한다. 끄면 중단/삭제하고, 기술 제안은 `skill-authoring.js`와 기존 항목별 편집기를 통해 사용자가 저장한다. API 키와 연결 인증은 프롬프트에 넣지 않는다.
- `erencha-identity.js`는 명시된 본명·닉네임 쌍만 병합 근거로 삼는다. 선택된 인물의 기존 자원·소지금·중복 항목 수치를 유지하고 없는 기술/물품만 옮긴다. 예전 인물 원자료는 identityArchive에 보관하고 비활성화하며 과거 결과는 바꾸지 않는다. 이름이 비슷하다는 이유만으로 합치지 않는다.
- `skill-authoring.js`는 새 기술을 임시 편집 상태에서 만든 뒤 저장 버튼에서만 실제 상태에 넣는다. 에렌샤의 새 기술·숙련도는 전용 엔진 편집 경로를 사용한다.
- 에렌샤 전투는 저장된 턴테이블 설정을 따르며 각 step의 행동자/피격자 이름을 함께 반환한다. 독·자기 HP 비용은 방어구 피격 마모를 일으키지 않는다. 공격 무기 마모는 사용자가 요청한 실제 가한 피해/50 기준을 유지한다.

## 0.21.1 보완 연결

- `nyunyu-knowledge.js`는 현재 룰북과 질문 주제의 지식을 선택한다. 0.22.1부터 퍼센트 증감·배수·고정 수치·백분율 필드의 단위 지침은 질문 키워드와 관계없이 항상 전달한다. 이미 저장된 큰 배율을 오기라고 추정해 일괄 변경하지 않는다. `nyunyu-proposals.js`는 제안을 기존 기술/장비/에렌샤 편집기 또는 룰북별 항목 폼으로 연결한다. 관리자 저장 경로와 편집 당시 스냅샷을 재사용하며 제안 생성 자체는 게임을 변경하지 않는다.
- `erencha-rules.merge`는 재구축 인물을 명시된 이름·본명·닉네임·별칭으로 연결하고 기존 ID와 획득 기록을 보존한다. 몬스터에는 이름 병합을 적용하지 않는다.
- `review-actions.js`는 검사에 실제 저장 호출 인수를 제공한다. 소모품 누락 보완은 전투 밖의 직접 사용만 기존 엔진으로 처리하며, 새 난수 호출이 필요하면 Repository 후보 상태를 저장하지 않는다. `tool-runtime`의 이 제한은 검사에서 요청한 inventory.use에만 적용된다.
- 구축 적용/탭 이탈/채팅 변경에서 편집 상태를 정리한다. `compiler.editDraft`는 이미 적용된 초안 수정을 거부하고 실제 게임 편집은 기존 관리자 거래로 저장한다.
- `adventure.js`는 생성이 끝난 장소 초안을 채팅 범위·profileRef·정확한 준비 입력에 묶어 보관한다. 저장 게임의 지도 상태를 우선하고, 생성 캐시는 답변 재생성에서만 재사용할 수 있다. 선행 생성이나 유료 추가 호출, processing 응답/재호출 프로토콜은 없다. 외부 콜백 대기 제한은 변경하지 않는다.

## 0.22.9 · 표시 인물과 진행 연결

actor-presence.js가 사용자 아바타 ID와 현재 표시 명단을 분리합니다. registry 등록은 표시·교전 참가와 같지 않습니다. 에렌샤 상태창은 사용자 ID를 사용하고, 실제 act/check 참가자와 전투 참가자는 화면에 연결합니다. runtime-details-ui.js는 전체 화면·미니보드의 현재 효과/기술/장비/퀘스트 표시를 공유합니다.

combat-options.js의 fastCombat은 위임과 명시적 선택 경계를 지키면서 최대 6라운드로 묶고 120단계를 기준으로 자동 반복을 제한합니다. 한 기술의 타격·연계는 끝까지 처리합니다. halfEnemyHP는 원래 정의를 변경하지 않는 전투 상태 효과입니다. turn-review.js는 dependsOn(앞선 보완의 1부터 시작하는 번호)와 같은 사건 관계로 종속 실패만 보류하고 독립 작업은 계속 처리합니다. erencha-quests.js는 보상 미기록/고정/지급 완료를 분리합니다.

repository.js의 불변 revision 메모리 캐시와 lifecycle의 정상 이어가기 경로는 과거 저장본 전체 로딩을 줄입니다. 저장 쓰기 확인과 분기 식별은 유지합니다. storageSlow 기록과 호스트 진단의 반환 전 출력 관측은 지연 구간을 찾는 자료이며 외부 타이머의 증거로 단정하지 않습니다.

## 0.23.0 행동 게이지

action-gauge.js는 d100/헌터/무림의 engine과 별도 Erencha engine이 공유하는 진행 계산이다. combatOptions.mode의 round/gauge/free와 현재 전투의 combat.turnMode를 구분한다. Erencha의 기존 combat.mode=pve|duel|pvp는 사망/보상 규칙이므로 그대로 둔다. 구형 turnTable 불리언은 mode가 없을 때 round/free로 읽으며 진행 중인 과거 전투에 게이지를 새로 주입하지 않는다.

게이지 값·논리 시간·완료 행동 수·검증된 속도 수식 AST를 현재 전투와 함께 저장한다. 0.23.0은 일반 행동 종료에만100을 소비하고 준비된 다음 행동자까지 필요한 최소 시간만 이동했다. 0.25.5부터는 위의 행동 중 충전과 readyAt 순서를 함께 사용한다. 새 합류자는0에서 시작한다. 같은 행동자가 연속 선정돼도 완료 행동 번호로 턴 완료 여부를 구분한다. 새 배틀에서 효과의 내부 시간 예약만 초기화하며 남은 지속량은 보존한다.

effect-system은 gaugeSpeed/gaugeChange와 durationBasis를 처리한다. 기본은 대상의 자기 차례이고 combat_time은 기본 속도로 한 차례에 해당하는10 논리 시간마다 만료·지속 피해/회복을 처리한다. 대기/서술/화면 조회는 시간을 진행시키지 않는다. 저장된 연계·반격은 일반 게이지를 추가 소비하지 않는다. 전투가 길어는 게이지에서 최대60회 일반 행동을 묶되 실제 사용자 선택 경계를 지킨다.

UI·미니보드는 현재 snapshot만 읽고, 결과 카드는 각 하위 실행 단계에 저장된 snapshot을 읽는다. 카드 표식·배치·호스트 훅은 기존 경로다. common/erencha 도구 설명과 공통 효과 프로토콜, 뉴뉴 지식·설정 제안, 놓치지마 검사의 현재 전투 자료에 선택 방식을 함께 전달한다. MCP 도구 이름·연결 모듈·저장 namespace는 바꾸지 않는다.
