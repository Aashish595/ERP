@echo off
cd /d "%~dp0"

set "PS_EXE="

where pwsh.exe >nul 2>&1 && set "PS_EXE=pwsh.exe"
if not defined PS_EXE if exist "%ProgramFiles%\PowerShell\7\pwsh.exe" set "PS_EXE=%ProgramFiles%\PowerShell\7\pwsh.exe"
if not defined PS_EXE where powershell.exe >nul 2>&1 && set "PS_EXE=powershell.exe"
if not defined PS_EXE if exist "%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" set "PS_EXE=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"

if not defined PS_EXE (
  echo PowerShell was not found. From your current PowerShell window run:
  echo   Set-ExecutionPolicy -Scope Process Bypass
  echo   .\WATCH_API_LOGS.ps1
  exit /b 1
)

"%PS_EXE%" -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0WATCH_API_LOGS.ps1" %*
