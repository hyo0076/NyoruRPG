# NyoruRPG 0.40.11

- 미니창이 채팅 화면의 변화를 감지해 대기 중 위치 확인을 줄입니다.
- 룰북 화면과 MCP 도구 목록을 열 때 같은 자료를 반복해서 준비하는 일을 줄였습니다.
- AI 연결에 GitHub Copilot을 추가했습니다. GitHub OAuth 토큰이나 Copilot 세션 토큰으로 연결할 수 있습니다.
- Copilot의 Gemini 4 Argon 스트리밍 응답과 연결 오류 안내를 지원합니다.

**플러그인만 업데이트. 모듈 v1은 그대로**

**AI 연결 → 기본 API**에서 **API 형식**을 **GitHub Copilot**으로 선택하세요.

1. GitHub OAuth 토큰 또는 Copilot 세션 토큰을 입력합니다.
2. 모델 ID를 확인합니다. 기본값은 `gemini-4-argon`입니다.
3. **연결 확인** 후 **연결 설정 저장**을 누릅니다.
