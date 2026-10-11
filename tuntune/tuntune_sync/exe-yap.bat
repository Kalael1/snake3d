@echo off
cd /d "%~dp0"
echo TUNTUNE SYNC .exe olarak derleniyor...
python -m pip install --upgrade pyinstaller tkinterdnd2 || py -m pip install --upgrade pyinstaller tkinterdnd2
python -m PyInstaller --noconfirm --onefile --windowed --name "TUNTUNE SYNC" --add-data "fonts;fonts" --collect-all tkinterdnd2 tuntune_sync.py || py -m PyInstaller --noconfirm --onefile --windowed --name "TUNTUNE SYNC" --add-data "fonts;fonts" --collect-all tkinterdnd2 tuntune_sync.py
echo.
echo Hazir: dist\TUNTUNE SYNC.exe
pause
