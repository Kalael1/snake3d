@echo off
cd /d "%~dp0"
echo Surukle-birak destegi kuruluyor...
python -m pip install --upgrade tkinterdnd2 || py -m pip install --upgrade tkinterdnd2
pause
