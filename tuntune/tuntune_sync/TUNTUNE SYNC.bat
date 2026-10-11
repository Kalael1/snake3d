@echo off
cd /d "%~dp0"
where python >nul 2>nul && (python tuntune_sync.py) || (py tuntune_sync.py)
if errorlevel 1 pause
