@echo off
title Gerenciador de IPs - Servidor

cd /d "%~dp0"

echo ==========================================
echo  Gerenciador de IPs
echo ==========================================
echo.
echo Iniciando servidor local...
echo.

if not exist "runtime\node.exe" (
  echo ERRO: O arquivo runtime\node.exe nao foi encontrado.
  echo.
  echo Verifique se a pasta runtime existe e contem o node.exe.
  pause
  exit /b
)

if not exist "server.js" (
  echo ERRO: O arquivo server.js nao foi encontrado.
  echo.
  pause
  exit /b
)

start "" "http://localhost:3000"

"runtime\node.exe" "server.js"

echo.
echo Servidor encerrado.
pause