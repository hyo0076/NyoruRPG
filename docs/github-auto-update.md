# NyoruRPG

RisuAI용 RPG 플러그인과 진행 지침 모듈의 배포 저장소입니다.

## 다운로드

- [플러그인 NyoruRPG.js](https://raw.githubusercontent.com/hyo0076/NyoruRPG/main/NyoruRPG.js)
- [모듈 NyoruRPG.risum](https://github.com/hyo0076/NyoruRPG/raw/refs/heads/main/NyoruRPG.risum)

새 사용자는 플러그인 `.js`를 RisuAI 플러그인 설정에, 모듈 `.risum`을 모듈 설정에 가져오세요. 기존 사용자는 플러그인을 업데이트하고 **시스템 구축 → 기존 모듈을 연결 전용으로 전환**을 한 번 실행한 뒤 Risu를 새로 고침합니다. [기존 설정을 보존하는 전환 방법](nyoru-release-0.22.0.md). 이전에 설치한 플러그인에 업데이트 주소가 없다면 이 배포본으로 한 번 교체해야 합니다.

## 플러그인 업데이트 주소

```text
https://raw.githubusercontent.com/hyo0076/NyoruRPG/main/NyoruRPG.js
```

플러그인 머리말의 `//@version`과 `//@update-url`을 통해 RisuAI가 새 버전을 확인할 수 있도록 배포합니다. 연결 모듈 v1 전환 뒤 일반 기능·룰북 지침·테마 변경은 플러그인 업데이트로 적용합니다. 모듈은 연결 규약 자체가 바뀔 때만 별도 전환 안내를 따릅니다.

## 배포 관리

새 버전은 버전 번호를 올려 빌드한 뒤, 저장소의 `NyoruRPG.js`를 교체합니다. 모듈이 바뀌었다면 `NyoruRPG.risum`도 함께 교체합니다. 기존 설치를 유지하기 위해 플러그인 내부 이름 `universal-rpg-engine`과 위 파일 주소는 유지합니다.

이 저장소에는 배포 파일만 올립니다. API 키, 사용자 설정, 게임 백업, 채팅 기록은 포함하지 않습니다. 포함된 구성 요소의 고지는 `THIRD_PARTY.md`와 `RPACK-LICENSE`, `RPACK-LICENSE-MIT`를 참고하세요.
