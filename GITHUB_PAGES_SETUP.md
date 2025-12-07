# GitHub Pages Setup Guide

This document contains the remaining manual steps to complete GitHub Pages deployment.

## Prerequisites Completed

The following have been configured automatically:
- [x] GitHub Actions workflow (`.github/workflows/deploy.yml`)
- [x] SvelteKit static adapter configured (`web-app/svelte.config.js`)
- [x] Prerender settings (`web-app/src/routes/+layout.js`)
- [x] Production branch created locally

## Manual Steps Required

### Step 1: Push Changes to GitHub

Run these commands to push all changes:

```bash
# Switch back to main and commit changes
git checkout main
git add -A
git commit -m "Add GitHub Pages deployment workflow and static adapter configuration"

# Push main branch
git push origin main

# Push production branch
git checkout production
git push -u origin production
```

### Step 2: Enable GitHub Pages in Repository Settings

1. Go to https://github.com/science/ai-translator/settings/pages
2. Under **Build and deployment**:
   - **Source**: Select "GitHub Actions"
3. Click **Save**

### Step 3: Verify Workflow Runs

1. Go to https://github.com/science/ai-translator/actions
2. You should see a "Deploy to GitHub Pages" workflow
3. Click on it to see run status
4. First run triggers automatically when you push to `production` branch

### Step 4: Access Your Site

After successful deployment, your site will be available at:
```
https://science.github.io/ai-translator/
```

## Deployment Workflow

To deploy updates to GitHub Pages:

1. Make changes on `main` branch
2. Merge or rebase changes into `production` branch:
   ```bash
   git checkout production
   git merge main
   git push origin production
   ```
3. GitHub Actions will automatically build and deploy

## Troubleshooting

### Build Fails
- Check the Actions tab for error logs
- Ensure `web-app/package-lock.json` exists (required for npm ci)
- Verify Node.js version compatibility

### 404 on Subpages
- This is a SPA routing issue
- The `fallback: '404.html'` in svelte.config.js handles this
- GitHub Pages serves 404.html for unknown routes, enabling client-side routing

### Base Path Issues
- If links are broken, check the `base` path in `svelte.config.js`
- Should match your repository name: `/ai-translator`

### Manual Workflow Trigger
You can manually trigger deployment from the Actions tab:
1. Go to Actions > Deploy to GitHub Pages
2. Click "Run workflow"
3. Select `production` branch
4. Click "Run workflow" button
