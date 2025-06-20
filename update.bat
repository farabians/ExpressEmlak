@echo off
echo.
echo ============================================
echo    EXPRESS EMLAK - WEBSITE GUNCELLEME
echo ============================================
echo.

:: Mevcut değişiklikleri kontrol et
echo [1/4] Degisiklikler kontrol ediliyor...
git status

echo.
echo [2/4] Tum dosyalar Git'e ekleniyor...
git add .

echo.
echo [3/4] Commit mesaji giriliyor...
set /p commit_message="Commit mesajinizi girin (Enter = otomatik mesaj): "

if "%commit_message%"=="" (
    set commit_message=Website guncellendi - %date% %time%
)

git commit -m "%commit_message%"

echo.
echo [4/4] GitHub'a yukleniyor...
git push origin main

echo.
echo ============================================
echo    GUNCELLEME TAMAMLANDI!
echo ============================================
echo.
echo Siteniz 2-5 dakika icinde guncellenecek:
echo https://farabians.github.io/ExpressEmlak
echo.
echo GitHub Actions'dan ilerlemeyi takip edebilirsiniz:
echo https://github.com/farabians/ExpressEmlak/actions
echo.
pause 