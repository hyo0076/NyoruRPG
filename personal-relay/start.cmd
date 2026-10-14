@echo off
chcp 65001 >nul
setlocal DisableDelayedExpansion
set "NYORU_RELAY_SCRIPT=%~dp0server.cjs"
rem Do not keep either the launcher or Node working inside the extracted folder.
cd /d "%SystemRoot%"
if errorlevel 1 exit /b 1
where node.exe >nul 2>nul
if errorlevel 1 (
  echo Node.js 20 이상이 필요합니다. Node.js를 설치한 뒤 이 파일을 다시 실행해 주세요.
  pause
  exit /b 1
)
node.exe -e "if(Number(process.versions.node.split('.')[0])<20)process.exit(1)"
if errorlevel 1 (
  echo 설치된 Node.js 버전이 낮습니다. Node.js 20 이상으로 업데이트한 뒤 다시 실행해 주세요.
  pause
  exit /b 1
)
rem The server owns its console; this batch file finishes instead of waiting.
start "Nyoru Personal MCP Relay" /D "%SystemRoot%" node.exe "%NYORU_RELAY_SCRIPT%" --console %*
if errorlevel 1 (
  echo 중계기 실행창을 열지 못했습니다. Node.js 설치 상태를 확인해 주세요.
  pause
  exit /b 1
)
exit /b 0
