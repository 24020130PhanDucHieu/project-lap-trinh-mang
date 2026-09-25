@echo off
title OTTv2 Game Server & Online Tunnel
echo ========================================================
echo   DANG KHOI CHAY SERVER OTTv2 VA TAO LINK ONLINE INTERNET
echo ========================================================
echo.
start "OTTv2 Server" cmd /k "npm start"
timeout /t 3 /nobreak >nul
start "OTTv2 Online Link" cmd /k "npm run tunnel"
echo Da khoi chay xong! Vui long kiem tra cua so "OTTv2 Online Link" de lay duong link cong khai.
