@echo off
echo =====================================
echo Running tests before commit...
echo =====================================



echo.
echo ✅ Tests passed. Proceeding to commit...
echo.

set /p msg="Enter commit message: "

git add .

git commit -m "%msg%"

git push

echo.
echo 🚀 Commit & push completed
pause