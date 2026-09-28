# NyoruRPG

RisuAI용 RPG 플러그인과 진행 지침 모듈의 배포 저장소입니다.

## 다운로드

- [플러그인 NyoruRPG.js](https://raw.githubusercontent.com/hyo0076/NyoruRPG/main/NyoruRPG.js)
- [모듈 NyoruRPG.risum](https://github.com/hyo0076/NyoruRPG/raw/refs/heads/main/NyoruRPG.risum)

플러그인 `.js`는 RisuAI 플러그인 설정에, 모듈 `.risum`은 모듈 설정에 가져오세요. 이전에 설치한 플러그인에 업데이트 주소가 없다면 이 배포본으로 한 번 교체해야 합니다.

## 플러그인 업데이트 주소

```text
https://raw.githubusercontent.com/hyo0076/NyoruRPG/main/NyoruRPG.js
```

플러그인 머리말의 `//@version`과 `//@update-url`을 통해 RisuAI가 새 버전을 확인할 수 있도록 배포합니다. 모듈은 이 플러그인 업데이트 주소로 함께 갱신되지 않으므로, 모듈 변경이 있는 릴리스에서는 `.risum`도 교체하세요.

## 배포 관리

새 버전은 버전 번호를 올려 빌드한 뒤, 저장소의 `NyoruRPG.js`를 교체합니다. 모듈이 바뀌었다면 `NyoruRPG.risum`도 함께 교체합니다. 기존 설치를 유지하기 위해 플러그인 내부 이름 `universal-rpg-engine`과 위 파일 주소는 유지합니다.

이 저장소에는 배포 파일만 올립니다. API 키, 사용자 설정, 게임 백업, 채팅 기록은 포함하지 않습니다. 포함된 구성 요소의 고지는 `THIRD_PARTY.md`와 `RPACK-LICENSE`, `RPACK-LICENSE-MIT`를 참고하세요.
