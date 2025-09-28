#!/bin/bash

# Deployment script for Omegle Gender Match application

echo "🚀 Starting deployment process..."

# Check if we're on the right directory
if [ ! -f "server.js" ]; then
    echo "❌ Error: server.js not found. Please run this script from the project root directory."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install --production

# Build step (if needed)
echo "🔨 Building application..."
# Add build steps here if needed

# Deploy to Heroku (if Heroku CLI is installed and user is logged in)
if command -v heroku &> /dev/null; then
    echo ".heroku CLI found. Do you want to deploy to Heroku? (y/n)"
    read -r deploy_heroku
    
    if [ "$deploy_heroku" = "y" ]; then
        echo "🌐 Deploying to Heroku..."
        
        # Check if Heroku app exists
        if ! heroku apps:info &> /dev/null; then
            echo "📝 Creating new Heroku app..."
            heroku create
        fi
        
        # Set buildpack
        heroku buildpacks:set heroku/nodejs
        
        # Deploy
        git add .
        git commit -m "Deploy $(date)"
        git push heroku main
        
        echo "✅ Deployment to Heroku completed!"
        echo "🔗 Your app is available at: $(heroku info -s | grep web_url | cut -d= -f2)"
    fi
else
    echo "⚠️  Heroku CLI not found. Skipping Heroku deployment."
fi

echo "🏁 Deployment process completed!"

# Instructions for other deployment methods
echo ""
echo "For other deployment options, please refer to DEPLOYMENT.md:"
echo " - AWS Elastic Beanstalk"
echo " - Google Cloud Platform"
echo " - DigitalOcean App Platform"
echo " - Docker deployment"
echo " - Traditional VPS deployment"