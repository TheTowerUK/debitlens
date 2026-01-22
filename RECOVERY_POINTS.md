# Recovery Points

## Recovery: Last Known Good Working State

### Branch:
- **`recovery/working-state`** (mutable, protected)
  - Current working state
  - Can be updated as needed
  - Pushed to remote
  - **⚠️ Do not develop on recovery/working-state; only fast-forward it from dev when stable.**

### Tags:
- **`recovery/working-state-2026-01-21`** – Last known good Visual Studio working state (pre-Cursor)
  - Immutable reference point
  - Created: 2026-01-21
  - Commit: `8072d30` - "Fix: Rename headerOptions.ts to .tsx to support JSX syntax"
- **`recovery/working-state-2026-01-22`** – Verified stable checkpoint (working code)
  - Same commit as 2026-01-21, verified working on 2026-01-22
  - Immutable reference point
  - Commit: `ceb86f1` - "Add recovery points documentation"
- **`recovery/working-state-2026-01-22-docs`** – Verified stable checkpoint with updated documentation
  - Working code state + complete recovery documentation
  - Immutable reference point
  - Created: 2026-01-22
  - Commit: `a275b80` - "Update recovery points documentation with naming convention"

## How to Restore

### Restore (Safe - Creates New Branch):
```powershell
git fetch --all --tags
git switch -c restore/from-recovery origin/recovery/working-state
```

### Inspect Only (Read-Only):
```powershell
git checkout recovery/working-state-2026-01-21
```

### Quick Switch to Working Branch:
```powershell
git checkout recovery/working-state
```

## Current Working State Details

**Status:** ✅ App is working correctly

**Features:**
- Full DashboardScreen restored (647 lines)
- Using AppContext and RootNavigator
- SessionWatcher implemented (5-minute timeout)
- All navigation working
- All data features functional

**Base Branch:** `rescue-before-clean`

## Future Recovery Point Naming Convention

When creating new recovery points, follow this format:

### Branch:
- `recovery/working-state` (mutable, protected)
  - Always points to the latest known good state
  - Can be updated when a new working state is confirmed

### Tags:
- `recovery/working-state-YYYY-MM-DD` (immutable)
  - Date-stamped for historical reference
  - Never changed once created
  - Example: `recovery/working-state-2026-01-21`

### Creating a New Recovery Point:

```powershell
# 1. Ensure you're on a working state
git checkout <working-branch>

# 2. Create dated tag
git tag -a recovery/working-state-YYYY-MM-DD -m "Description of working state"

# 3. Update or create the branch
git branch -f recovery/working-state  # Update existing
# OR
git switch -c recovery/working-state  # Create new

# 4. Push both
git push origin recovery/working-state
git push origin recovery/working-state-YYYY-MM-DD
```

## Other Recovery Points

### `rescue/before-restore`
- Contains all back button fixes
- DashboardScreen restoration attempts
- React hooks fixes
- Android build scripts

### `rescue-before-clean`
- Original Visual Studio version
- Working state before Cursor review
- Base for current working state

## Daily Development Workflow

**⚠️ IMPORTANT: Do not develop on recovery/working-state; only fast-forward it from dev when stable.**

### Working on Daily Changes:

Use the `dev` branch for all daily development work:

```powershell
# Start daily work
git switch dev

# Make your changes, then commit
git add -A
git commit -m "Description of changes"
git push
```

### Promoting Stable Changes to Recovery:

When your changes are stable and tested, merge them into the recovery branch:

```powershell
# Switch to recovery branch
git switch recovery/working-state

# Merge dev (fast-forward only - ensures clean history)
git merge --ff-only dev

# Push the updated recovery branch
git push

# Create a dated tag for this stable checkpoint
$dt = Get-Date -Format "yyyy-MM-dd"
git tag -a "recovery/working-state-$dt" -m "Stable checkpoint $dt"
git push origin "recovery/working-state-$dt"
```

**Important:**
- **⚠️ Do not develop on recovery/working-state; only fast-forward it from dev when stable.**
- Always test thoroughly before merging to `recovery/working-state`
- Use `--ff-only` to prevent merge commits and keep history clean
- If merge fails (not fast-forward), your dev branch has diverged - rebase or review changes first
- Tags are immutable - create them only for verified stable states

## Notes
- **⚠️ Do not develop on recovery/working-state; only fast-forward it from dev when stable.**
- Always test thoroughly before creating a recovery point
- Tags are immutable - use for historical snapshots
- Branches are mutable - use for current working state
- Always push recovery points to remote for safety
- Use `dev` branch for daily work, `recovery/working-state` for stable checkpoints
