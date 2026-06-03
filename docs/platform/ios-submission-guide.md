Purpose:

Step-by-step guide for submitting iOS builds to App Store Connect.

Prerequisites:

Apple Developer account
App Store Connect app record
EAS credentials configured
Valid provisioning profile and distribution certificate

Build & Submit:

eas build --platform ios --profile production
eas submit --platform ios

App Store Connect Flow:

Upload build (via EAS Submit or Transporter)
↓
TestFlight internal testing
↓
TestFlight external testing (optional)
↓
Submit for Review
↓
Release (manual or automatic)

Checklist Before Submission:

Version and build number incremented
Release notes prepared
Screenshots up to date
Privacy policy URL valid
Export compliance answered
Age rating accurate
