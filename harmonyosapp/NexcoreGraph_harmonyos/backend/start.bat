@echo off
rem 启核图策 · 启动本地同步后端（需 MySQL80 服务已启动，root/123456）
cd /d %~dp0
set PATH=D:\CodeEditor\DevEcoStudio\DevEco Studio\tools\node;%PATH%
node server.js
