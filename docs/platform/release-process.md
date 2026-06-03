Purpose:

Your personal deployment cheat sheet.

Example:

Version Update
Update app version
Update iOS build number
Update Android versionCode
Git
git status
git add .
git commit -m "Release x.x.x"
git push
iOS
eas build --platform ios
eas submit --platform ios

Then:

App Store Connect
↓
TestFlight
↓
Submit for Review
↓
Release
Android
eas build --platform android

Upload:

Google Play Console
↓
Internal Testing
↓
Closed Testing
↓
Production
