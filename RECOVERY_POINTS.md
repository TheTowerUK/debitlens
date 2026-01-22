# Recovery Points

## Recovery: Last Known Good Working State

### Branch:
- **`recovery/working-state`** (mutable, protected)
  - Current working state
  - Can be updated as needed
  - Pushed to remote

### Tags:
- **`recovery/working-state-2026-01-21`** – Last known good Visual Studio working state (pre-Cursor)
  - Immutable reference point
  - Created: 2026-01-21
  - Commit: `8072d30` - "Fix: Rename headerOptions.ts to .tsx to support JSX syntax"

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

## Notes
- Always test thoroughly before creating a recovery point
- Tags are immutable - use for historical snapshots
- Branches are mutable - use for current working state
- Always push recovery points to remote for safety
