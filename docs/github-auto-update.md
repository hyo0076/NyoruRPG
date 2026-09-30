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

0.22.3부터 NyoruRPG 창을 열면 GitHub의 작은 공개 파일 `updates.json`으로 새 버전을 확인합니다. 확인 간격은 6시간이며, 창 하단 **업데이트 내역**에서 자동 확인을 끄거나 수동으로 확인할 수 있습니다. 업데이트를 설치한 뒤 처음 창을 열면 내장 변경 내역이 표시됩니다. 읽은 버전은 저장하므로 같은 알림을 반복하지 않습니다. 네트워크 연결이 없어도 내장 변경 내역은 볼 수 있습니다.

새 버전 알림은 설치 기능과 별개입니다. 설치하려면 RisuAI 설정 → 플러그인의 NyoruRPG 업데이트 버튼을 사용하고 새로 고침하세요. 이 조회는 AI 연결을 사용하지 않으며 사용자 채팅·세이브·API 키를 보내지 않습니다.

## 배포 관리

새 버전은 버전 번호를 올려 빌드한 뒤, 저장소의 `NyoruRPG.js`를 교체합니다. 모듈이 바뀌었다면 `NyoruRPG.risum`도 함께 교체합니다. 기존 설치를 유지하기 위해 플러그인 내부 이름 `universal-rpg-engine`과 위 파일 주소는 유지합니다.

개발 시 `src/update-notes.js` 맨 앞에 새 버전의 사용자용 변경 내역을 추가하고 `latest`를 같은 버전으로 올립니다. 빌드가 `dist/updates.json`을 만들며 플러그인과 함께 저장소 루트의 `updates.json`으로 게시합니다. 버전·변경 내역이 맞지 않으면 빌드를 중단합니다. 알림 기능을 위해 모듈이나 게임 데이터를 변경하지 않습니다.

이 저장소에는 배포 파일만 올립니다. API 키, 사용자 설정, 게임 백업, 채팅 기록은 포함하지 않습니다. 포함된 구성 요소의 고지는 `THIRD_PARTY.md`와 `RPACK-LICENSE`, `RPACK-LICENSE-MIT`를 참고하세요.
