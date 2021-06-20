# Overview

This document provides instructions and notes for those contributing to the project.

# Publishing to GitHub Packages

## Login to GitHub NPM

```
npm login --scope=@pwrdrvr --registry=https://npm.pkg.github.com

# Supply: github username
# GitHub Personal Access Token
# Public NPM Email
```

## Publish New Version

- Bump version number in package.json
- `npm publish`
