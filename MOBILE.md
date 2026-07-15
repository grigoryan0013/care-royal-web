# Care Royal — Native apps (Capacitor)

Same approach as Tegula: a thin Capacitor shell around the deployed web app
(`capacitor.config.ts` `server.url`), so app-store builds don't need a rebuild
for every content change — they load the live site.

## First-time setup
```bash
cd ~/Desktop/CareRoyal
npm install -D @capacitor/cli
npm install @capacitor/core @capacitor/ios @capacitor/android
npm run build            # produces ./out (fallback bundle)
npx cap add ios
npx cap add android
npx cap sync
```

## iOS (needs Xcode)
```bash
npx cap open ios
```
- Set the bundle id to `com.careroyal.app`, pick your team, set the app icon (reuse the Care Royal 1024 icon).
- Archive → upload to App Store Connect. (Tegula notes: manual signing worked best; free disk space before archiving to avoid Simulator preflight errors.)

## Android (needs JDK 21 + Android command-line tools)
```bash
brew install --cask android-commandlinetools   # if not installed
npx cap open android
# or headless:
cd android && ./gradlew bundleRelease           # -> app/build/outputs/bundle/release/*.aab
```
Sign with an upload keystore (same as Tegula's `*-upload-key.jks` flow).

## Push notifications (phase 2)
Reuse the Tegula FCM pattern: add `@capacitor/push-notifications`, register the
token, and store it on `users/{uid}` so the app can notify on new bookings,
approvals and messages. The in-app notification bell already surfaces these
events client-side today.

## Note on this Mac
Per prior Tegula work: Xcode.app / CocoaPods / Android SDK may need installing,
and low disk space breaks the iOS Simulator. Budget setup time accordingly.
