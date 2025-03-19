@echo off
cls

@echo The Editor - Docker Container Updater
@echo =========================================================
@echo.

@echo This script will update your Docker container with the latest code changes.
@echo Make sure all your changes are saved before proceeding.
@echo.

@echo Enter the name of your Docker container (default: Periwinkle):
@set /p ContainerName=
@if "%ContainerName%"=="" set ContainerName=Periwinkle

@echo.
@echo Checking if container "%ContainerName%" exists...

docker container inspect %ContainerName% >nul 2>&1
@if %ERRORLEVEL% NEQ 0 (
    @echo Error: Container "%ContainerName%" not found.
    @echo Please check the container name and try again.
    @goto end
)

@echo Container found. Preparing to update...
@echo.

@echo Do you want to backup your database and logs? (Y/N):
@set /p Backup=
@if /i "%Backup%"=="Y" goto do_backup
@goto skip_backup

:do_backup
    @echo.
    @echo Backing up database and logs...
    
    @echo Enter backup folder path (default: ./backups):
    @set /p BackupPath=
    @if "%BackupPath%"=="" set BackupPath=./backups
    
    @if not exist "%BackupPath%" mkdir "%BackupPath%"
    
    @set BackupDate=%date:~-4%-%date:~4,2%-%date:~7,2%_%time:~0,2%-%time:~3,2%-%time:~6,2%
    @set BackupDate=%BackupDate: =0%
    
    docker cp %ContainerName%:/usr/src/app/database "%BackupPath%\database_%BackupDate%"
    docker cp %ContainerName%:/usr/src/app/logs "%BackupPath%\logs_%BackupDate%"
    
    @echo Backup completed at %BackupPath%
    @echo.

:skip_backup
@echo Stopping container...
docker stop %ContainerName%

@echo.
@echo Removing container...
docker rm %ContainerName%

@echo.
@echo Building new image with latest code...
docker-compose build

@echo.
@echo Starting updated container...
docker-compose up -d

@echo.
@echo Checking container status...
timeout /t 5 >nul
docker ps --filter "name=%ContainerName%"

@if %ERRORLEVEL% EQU 0 (
    @echo.
    @echo Status: Update Successful
    @echo The Editor has been updated and is now running.
) else (
    @echo.
    @echo Status: Error Detected
    @echo Error starting the container. Check Docker logs:
    @echo docker logs %ContainerName%
)

:end
@echo.
@echo =========================================================
@pause