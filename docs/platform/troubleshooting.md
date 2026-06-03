Purpose:

Common build, submit, and runtime issues with fixes.

Build Failures:

Issue: EAS build fails on credentials
Fix: Run eas credentials and reconfigure signing assets

Issue: Metro bundler error locally
Fix: Clear cache with npx expo start --clear

Submission Failures:

Issue: iOS build rejected — missing compliance
Fix: Complete export compliance in App Store Connect

Issue: Android upload rejected — versionCode conflict
Fix: Increment versionCode in app.config and rebuild

Runtime Issues:

Issue: API key not found in production
Fix: Verify EAS secrets and env vars for production profile

Issue: AsyncStorage data lost after update
Fix: Check migration logic for schema changes

Logs & Diagnostics:

eas build:list
eas submit:list
npx expo-doctor
