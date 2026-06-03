Purpose:

Step-by-step guide for submitting Android builds to Google Play Console.

Prerequisites:

Google Play Developer account
App created in Play Console
EAS credentials configured
Signing keystore configured in EAS

Build & Submit:

eas build --platform android --profile production
eas submit --platform android

Play Console Flow:

Upload AAB (via EAS Submit or manual upload)
↓
Internal testing
↓
Closed testing (optional)
↓
Open testing (optional)
↓
Production release

Checklist Before Submission:

versionCode incremented
Release notes prepared
Store listing complete
Content rating questionnaire done
Data safety form completed
Target API level meets Play requirements
