@echo off
echo =====================================
echo Running tests before commit...
echo =====================================



echo.
echo ✅ Tests passed. Proceeding to commit...
echo.

// ❌ What you wrote:
set /p msg="Enter commit message: "  // ✏️ repo-intel  // ✏️ repo-intel

set /p msg="Enter commit message: "  // ✏️ repo-intel  // ✏️ repo-intel

set /p msg="Enter commit message: "  // ✏️ repo-intel  // ✏️ repo-intel

set /p msg="Enter commit message: "  // ✏️ repo-intel

set /p msg="Enter commit message: "  // ✏️ repo-intel

set /p msg="Enter commit message: "  // ✏️ repo-intel

set /p msg="Enter commit message: "  // ✏️ repo-intel

set /p msg="Enter commit message: "

set /p msg="Enter commit message: "

set /p msg="Enter commit message: "

// ✅ Use strict equality:
set /p msg="Enter commit message: "  // ✏️ repo-intel  // ✏️ repo-intel

set /p msg="Enter commit message: "  // ✏️ repo-intel

set /p msg="Enter commit message: "  // ✏️ repo-intel

set /p msg="Enter commit message: "

git add .

git commit -m "%msg%"

git push

echo.
echo 🚀 Commit & push completed
pause