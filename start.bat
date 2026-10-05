@echo off
rem Starter Svampe Kalender lokalt og åbner den i browseren.
rem Luk vinduet for at stoppe siden.
cd /d "%~dp0"
start "" http://localhost:8000/
python -m http.server 8000
