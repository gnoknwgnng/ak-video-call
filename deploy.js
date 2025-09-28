#!/usr/bin/env node

// Deployment script for Omegle Gender Match application

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting deployment process...');

// Check if we're in the right directory
if (!fs.existsSync(path.join(__dirname, 'server.js'))) {
    console.error('❌ Error: server.js not found. Please run this script from the project root directory.');
    process.exit(1);
}

try {
    // Install dependencies
    console.log('📦 Installing dependencies...');
    execSync('npm install --production', { stdio: 'inherit' });
    
    // Build step (if needed)
    console.log('🔨 Building application...');
    // Add build steps here if needed
    
    // Check if Heroku CLI is installed
    try {
        execSync('heroku --version', { stdio: 'ignore' });
        console.log('🌐 Heroku CLI found.');
        
        // Ask user if they want to deploy to Heroku
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        rl.question('Do you want to deploy to Heroku? (y/n): ', (answer) => {
            if (answer.toLowerCase() === 'y') {
                deployToHeroku();
            } else {
                console.log('⏭️  Skipping Heroku deployment.');
                showDeploymentOptions();
            }
            rl.close();
        });
    } catch (error) {
        console.log('⚠️  Heroku CLI not found. Skipping Heroku deployment.');
        showDeploymentOptions();
    }
} catch (error) {
    console.error('❌ Deployment failed:', error.message);
    process.exit(1);
}

function deployToHeroku() {
    try {
        console.log('🌐 Deploying to Heroku...');
        
        // Check if Heroku app exists
        try {
            execSync('heroku apps:info', { stdio: 'ignore' });
            console.log('📝 Using existing Heroku app.');
        } catch (error) {
            console.log('📝 Creating new Heroku app...');
            execSync('heroku create', { stdio: 'inherit' });
        }
        
        // Set buildpack
        execSync('heroku buildpacks:set heroku/nodejs', { stdio: 'inherit' });
        
        // Deploy
        execSync('git add .', { stdio: 'inherit' });
        execSync('git commit -m "Deploy $(date)"', { stdio: 'inherit' });
        execSync('git push heroku main', { stdio: 'inherit' });
        
        // Get app URL
        const appInfo = execSync('heroku info -s', { encoding: 'utf8' });
        const urlMatch = appInfo.match(/web_url=([^\n]+)/);
        const appUrl = urlMatch ? urlMatch[1] : 'Unknown';
        
        console.log('✅ Deployment to Heroku completed!');
        console.log(`🔗 Your app is available at: ${appUrl}`);
        
        showDeploymentOptions();
    } catch (error) {
        console.error('❌ Heroku deployment failed:', error.message);
        showDeploymentOptions();
    }
}

function showDeploymentOptions() {
    console.log('\n🏁 Deployment process completed!');
    console.log('\nFor other deployment options, please refer to DEPLOYMENT.md:');
    console.log(' - AWS Elastic Beanstalk');
    console.log(' - Google Cloud Platform');
    console.log(' - DigitalOcean App Platform');
    console.log(' - Docker deployment');
    console.log(' - Traditional VPS deployment');
}