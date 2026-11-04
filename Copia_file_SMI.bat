@echo off
setlocal
title Copia file sistema di visione SMI

rem ============================================================
rem  Copia dal PC della visione solo i file utili per:
rem   - il sito "Validazione sensibilita SMI" (event.log, SMI_ANALYSIS.ini)
rem   - le analisi di andamento (log di sistema degli ultimi 7 giorni)
rem  Mettere questo file sulla chiavetta e aprirlo con doppio clic.
rem  I file vengono copiati sulla chiavetta in SMI_export\data_ora.
rem  Sul PC della visione non viene modificato ne cancellato nulla.
rem ============================================================

rem Cartella del programma SMI. Se la copia non trova i file,
rem cambiare solo questa riga con il percorso giusto.
set "SMI_DIR=C:\SMI"

if not exist "%SMI_DIR%\SMI_ANALYSIS.ini" (
  echo.
  echo  Non trovo SMI_ANALYSIS.ini nella cartella %SMI_DIR%
  echo  Apri questo file con il Blocco note e correggi la riga  set "SMI_DIR=..."
  echo  con la cartella in cui si trovano event.log e SMI_ANALYSIS.ini.
  echo.
  pause
  exit /b 1
)

for /f %%d in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HHmm"') do set "STAMP=%%d"
if "%STAMP%"=="" set "STAMP=export"
set "DEST=%~d0\SMI_export\%STAMP%"
mkdir "%DEST%" 2>nul

echo.
echo  Copia in corso da %SMI_DIR%
echo  verso %DEST%
echo.

for %%f in (event.log error.log SMI_ANALYSIS.ini EI_SYSTEM.ini SMI_IMAGE.ini analysis_time.log) do (
  if exist "%SMI_DIR%\%%f" (
    copy /y "%SMI_DIR%\%%f" "%DEST%\" >nul && echo   OK   %%f
  ) else (
    echo   --   %%f non presente
  )
)

rem Log di sistema degli ultimi 7 giorni (per le letture pezzo per pezzo)
robocopy "%SMI_DIR%" "%DEST%" system_event_trace*.log /MAXAGE:7 /R:1 /W:1 /NJH /NJS /NDL /NFL >nul
for /f %%n in ('dir /b "%DEST%\system_event_trace*.log" 2^>nul ^| find /c /v ""') do echo   OK   %%n log di sistema degli ultimi 7 giorni

echo.
echo  Fatto. Ora porta la cartella SMI_export\%STAMP% sul tuo PC
echo  e trascinala nel riquadro "File della visione" del sito.
echo.
start "" explorer "%DEST%"
pause
