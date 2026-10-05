# V-PULSE

Production website: https://vpulse-delta.vercel.app/

## Publish updates to GitHub and Vercel

Vercel production deploys from GitHub's **main** branch. Pushes to **master**
create preview deployments and do not update the production website.

### One-time setup

The existing `V-PULSE` workspace uses `master`. Create a separate checkout of
`main` for future production edits:

```bash
cd /Users/amalina/Documents/Projects
git clone --branch main https://github.com/amalinaemy/VPULSE.git VPULSE-main
cd VPULSE-main/frontend
npm ci
```

Run the clone only once. Make future edits inside **VPULSE-main**.
Changes made in the old `V-PULSE` folder are not copied automatically.

### Before starting new edits

```bash
cd /Users/amalina/Documents/Projects/VPULSE-main
git pull --ff-only origin main
```

If Git reports uncommitted changes or a conflict, resolve them before continuing.
Do not force-push to bypass a rejected update.

### Check and publish your edits

From `/Users/amalina/Documents/Projects/VPULSE-main`:

```bash
npm --prefix frontend run build
npm --prefix frontend run lint

git status
git diff
git add frontend/src frontend/docs
git commit -m "Describe your changes"
git push origin main
```

Continue to commit and push only when the checks pass. Replace the commit
message with a short description of your update.

The staging command includes frontend source and documentation changes. If you
also edit other files, add their paths explicitly before committing, for example:

```bash
git add README.md frontend/README.md
```

Review the staged changes with `git diff --cached`. Keep credentials, `.env`
files, dependencies and generated build outputs out of commits.

### Verify production

Vercel automatically deploys pushes to `main`; no separate Vercel command is
needed. In Vercel, confirm the latest deployment is **Production**, has the
expected commit, and has completed successfully. Then open:

https://vpulse-delta.vercel.app/

If an already-open tab still shows the previous version, reload it with
**Cmd + Shift + R** on Mac or **Ctrl + Shift + R** on Windows/Linux.

For API and environment configuration, see [frontend deployment notes](frontend/DEPLOYMENT.md).
