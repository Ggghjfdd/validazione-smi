@echo off
setlocal
title Copia dei parametri SMI per la dashboard NID 1

rem ============================================================
rem  Da eseguire UNA VOLTA sul PC della linea (doppio clic).
rem
rem  Edge non puo' leggere i file .ini (li blocca per sicurezza),
rem  quindi questo script ne fa una copia con estensione .txt
rem  ogni 5 minuti, in C:\SMI\copie_dashboard, invisibile.
rem  I file originali di SMI vengono solo letti: niente viene
rem  modificato o cancellato.
rem
rem  Per toglierlo:  schtasks /delete /tn "SMI copia ini dashboard" /f
rem ============================================================

set "SMI_DIR=C:\SMI"
set "DEST=%SMI_DIR%\copie_dashboard"

if not exist "%SMI_DIR%\SMI_ANALYSIS.ini" (
  echo.
  echo  Non trovo %SMI_DIR%\SMI_ANALYSIS.ini
  echo  Apri questo file con il Blocco note e correggi la riga  set "SMI_DIR=..."
  echo.
  pause
  exit /b 1
)

if not exist "%DEST%" mkdir "%DEST%"
if errorlevel 1 (
  echo.
  echo  Non riesco a creare la cartella %DEST%
  echo  Serve un utente con il permesso di scrittura in %SMI_DIR%.
  echo.
  pause
  exit /b 1
)

rem --- piccolo script che copia gli ini senza aprire finestre ---
> "%DEST%\copia.vbs" (
  echo On Error Resume Next
  echo Set f = CreateObject^("Scripting.FileSystemObject"^)
  echo f.CopyFile "%SMI_DIR%\SMI_ANALYSIS.ini", "%DEST%\SMI_ANALYSIS.ini.txt", True
  echo f.CopyFile "%SMI_DIR%\EI_SYSTEM.ini", "%DEST%\EI_SYSTEM.ini.txt", True
)

rem --- prima copia subito ---
cscript //nologo "%DEST%\copia.vbs"

rem --- poi ogni 5 minuti ---
schtasks /create /tn "SMI copia ini dashboard" /sc minute /mo 5 /tr "wscript.exe \"%DEST%\copia.vbs\"" /f >nul
if errorlevel 1 (
  echo.
  echo  La copia e' stata fatta, ma non riesco a programmarla ogni 5 minuti.
  echo  Chiedi all'IT di creare l'attivita' pianificata, oppure riesegui questo file quando cambiano i parametri.
  echo.
  pause
  exit /b 1
)

echo.
if exist "%DEST%\SMI_ANALYSIS.ini.txt" (
  echo  Fatto. I parametri verranno copiati ogni 5 minuti in %DEST%
  echo  Entro un minuto la dashboard mostra i parametri di analisi.
) else (
  echo  Attivita' creata, ma la prima copia non e' riuscita: controlla %DEST%
)
echo.
pause
