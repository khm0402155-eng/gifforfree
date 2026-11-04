@echo off
cd /d "%~dp0"
echo 브라우저에서 http://127.0.0.1:8765 를 여세요.
echo 종료하려면 이 창에서 Ctrl+C 를 누르세요.
python serve.py
