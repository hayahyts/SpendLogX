# Installing SpendLogX

`SpendLogX-0.1.0-arm64.apk` runs on any 64-bit ARM Android phone — which is
every mainstream phone sold since about 2017.

1. Download the APK to the phone.
2. Open it; allow "install from unknown sources" when Android asks. The app is
   signed with a development certificate, which is why the Play-Protect prompt
   appears — tap "install anyway".
3. First run: sign in with your email (local identity for now), name the
   household, add each account and type its balance — a debt is a negative,
   like -11599 — and you are in.

Everything is stored on the phone in SQLite. Nothing leaves the device;
Supabase sync is designed but not yet wired.

Built with `EXPO_PUBLIC_DEMO=0` (starts empty). To rebuild:

```bash
npm install
npx expo prebuild --platform android
cd android && EXPO_PUBLIC_DEMO=0 ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
```
