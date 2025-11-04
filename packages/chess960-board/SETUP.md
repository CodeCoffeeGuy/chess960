# Setting up GitHub Repository

## 1. Create a new repository on GitHub

1. Go to https://github.com/new
2. Repository name: `chess960-board`
3. Description: `A custom React chess board component optimized for Chess960 (Fischer Random Chess)`
4. Visibility: **Public** (for open source)
5. **DO NOT** initialize with README, .gitignore, or license (we already have these)
6. Click "Create repository"

## 2. Connect and push to GitHub

Run these commands in the `packages/chess960-board` directory:

```bash
# Add the remote (replace with your actual GitHub username if different)
git remote add origin https://github.com/nikostojak/chess960-board.git

# Push to GitHub
git branch -M main
git push -u origin main
```

## 3. Set up npm publishing (optional)

To publish to npm when you create releases:

1. Create an npm account at https://www.npmjs.com/signup
2. Generate an access token:
   - Go to https://www.npmjs.com/settings/YOUR_USERNAME/tokens
   - Click "Generate New Token"
   - Select "Automation" type
   - Copy the token
3. Add the token to GitHub Secrets:
   - Go to your repo → Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `NPM_TOKEN`
   - Value: Paste your npm token
   - Click "Add secret"

## 4. Creating releases

To publish a new version:

1. Update version in `package.json`
2. Create a git tag: `git tag v1.0.0`
3. Push tag: `git push origin v1.0.0`
4. Create a GitHub Release (this triggers the publish workflow)
   - Go to Releases → "Create a new release"
   - Choose the tag you just pushed
   - Add release notes
   - Click "Publish release"

The GitHub Actions workflow will automatically build and publish to npm!



