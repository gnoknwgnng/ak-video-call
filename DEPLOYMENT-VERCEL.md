# Deploying to Vercel

This guide explains how to deploy the entire Omegle Gender Match application to Vercel.

## Prerequisites

1. A Vercel account (free at https://vercel.com)
2. Vercel CLI installed:
   ```bash
   npm install -g vercel
   ```

## Deployment Steps

1. Login to Vercel:
   ```bash
   vercel login
   ```

2. Deploy the project:
   ```bash
   vercel --prod
   ```

## How It Works

Vercel will automatically:
1. Detect this as a Node.js project
2. Use the `vercel.json` configuration file
3. Deploy the server.js as a serverless function
4. Serve static files from the public directory

## Environment Variables

Vercel automatically sets the PORT environment variable. The application will use this port when deployed.

## Important Notes

1. **WebSockets**: Vercel has some limitations with WebSockets. The application is configured to use polling as a fallback.

2. **Cold Starts**: Serverless functions may have cold starts, which could add a small delay to the first connection.

3. **Scaling**: Vercel automatically scales the application based on demand.

## Custom Domain

To use a custom domain:
1. Add the domain in your Vercel dashboard
2. Update your DNS records as instructed by Vercel
3. Vercel will automatically provision an SSL certificate

## Monitoring

Vercel provides built-in monitoring and logs for your application. You can view them in the Vercel dashboard.

## Troubleshooting

If you encounter issues:

1. Check the deployment logs:
   ```bash
   vercel logs
   ```

2. Make sure all dependencies are in package.json

3. Verify that the vercel.json file is correctly configured

4. Ensure the server.js file exports the necessary functions for Vercel

## Updating the Deployment

To update your deployment after making changes:
```bash
git add .
git commit -m "Update application"
git push
vercel --prod
```

Or if you've connected your Git repository to Vercel, it will automatically deploy on every push to the main branch.