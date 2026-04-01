@echo off
echo =====================================
echo Committing and pushing all changes
echo =====================================

REM Set default commit message
set "msg=Auto commit"

git add .

git commit -m "%msg%"

git push

echo.
echo 🚀 Commit & push completed
pause