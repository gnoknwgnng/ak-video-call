@echo off
title Omegle Gender Match Deployment

echo 🚀 Starting deployment process...

REM Check if we're in the right directory
if not exist "server.js" (
    echo ❌ Error: server.js not found. Please run this script from the project root directory.
    pause
    exit /b 1
)

REM Install dependencies
echo 📦 Installing dependencies...
npm install --production

REM Build step (if needed)
echo 🔨 Building application...
REM Add build steps here if needed

REM Check if Heroku CLI is installed
where heroku >nul 2>&1
if %errorlevel% == 0 (
    echo 🌐 Heroku CLI found. Do you want to deploy to Heroku? (y/n)
    set /p deploy_heroku=""
    
    if /i "%deploy_heroku%"=="y" (
        echo 🌐 Deploying to Heroku...
        
        REM Check if Heroku app exists
        heroku apps:info >nul 2>&1
        if %errorlevel% neq 0 (
            echo 📝 Creating new Heroku app...
            heroku create
        )
        
        REM Set buildpack
        heroku buildpacks:set heroku/nodejs
        
        REM Deploy
        git add .
        git commit -m "Deploy %date% %time%"
        git push heroku main
        
        echo ✅ Deployment to Heroku completed!
        for /f "tokens=2 delims==" %%a in ('heroku info -s ^| findstr web_url') do set app_url=%%a
        echo 🔗 Your app is available at: %app_url%
    )
) else (
    echo ⚠️  Heroku CLI not found. Skipping Heroku deployment.
)

echo 🏁 Deployment process completed!

echo.
echo For other deployment options, please refer to DEPLOYMENT.md:
echo  - AWS Elastic Beanstalk
echo  - Google Cloud Platform
echo  - DigitalOcean App Platform
echo  - Docker deployment
echo  - Traditional VPS deployment

pause