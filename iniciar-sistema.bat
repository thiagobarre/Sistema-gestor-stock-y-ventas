@echo off
title Drugstore X - Sistema de Gestion de Stock y Ventas
echo =========================================================================
echo   SISTEMA DE GESTION DE STOCK Y VENTAS - DRUGSTORE "X" (CONCORDIA, E.R.)
echo   Ingenieria de Software II - Metodologia RUP / Norma IEEE-STD 830
echo =========================================================================
echo.
echo [1/2] Iniciando servidor local y base de datos SQLite embebida...
echo.

:: Iniciar el servidor en segundo plano
start /B node server.js

:: Esperar 2 segundos para asegurar el arranque del servidor
timeout /t 2 /nobreak >nul

echo [2/2] Abriendo interfaz de escritorio...
echo.

:: Verificar si Microsoft Edge esta disponible para abrir en modo App de escritorio (sin barra de navegador)
if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --app=http://localhost:3000
) else (
    start http://localhost:3000
)

echo.
echo =========================================================================
echo   El sistema se encuentra OPERATIVO.
echo   URL: http://localhost:3000
echo.
echo   Credenciales de prueba:
echo   - Gerente:  Usuario: gerente  ^| Contrasena: Gerente2026!#
echo   - Empleado: Usuario: empleado ^| Contrasena: Empleado2026!#
echo.
echo   Presione CTRL+C o cierre esta ventana para detener el servidor.
echo =========================================================================
pause
