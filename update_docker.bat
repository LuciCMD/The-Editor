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
    @echo Container "%ContainerName%" not found or not running.
    @echo Checking for stopped containers with the same name...
    
    docker ps -a --filter "name=%ContainerName%" --format "{{.ID}}" >nul 2>&1
    @if %ERRORLEVEL% EQU 0 (
        @echo Found stopped container. Will remove it before proceeding.
    ) else (
        @echo No container found with this name. Will create a new one.
    )
) else (
    @echo Container found and running. Preparing to update...
)
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
    
    docker cp %ContainerName%:/usr/src/app/database "%BackupPath%\database_%BackupDate%" 2>nul
    docker cp %ContainerName%:/usr/src/app/logs "%BackupPath%\logs_%BackupDate%" 2>nul
    
    @echo Backup completed at %BackupPath%
    @echo.

:skip_backup
@echo Stopping container...
docker stop %ContainerName% 2>nul

@echo.
@echo Removing container...
docker rm %ContainerName% 2>nul

@echo.
@echo Cleaning up unused Docker resources...
@echo - Removing dangling images...
docker image prune -f

@echo - Removing unused containers...
docker container prune -f

@echo - Pruning build cache (optional, may take time)
@echo Do you want to do a deep cleanup of build cache? (Y/N):
@set /p DeepClean=
@if /i "%DeepClean%"=="Y" (
    docker builder prune -f
) else (
    @echo Skipping deep cleanup.
)

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
    
    @echo.
    @echo Container Disk Usage Information:
    docker system df
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