# Installing SpendLogX

`SpendLogX-0.2.0-arm64.apk` runs on any 64-bit ARM Android phone — which is
every mainstream phone sold since about 2017.

1. Download the APK to the phone.
2. Open it; allow "install from unknown sources" when Android asks. The app is
   signed with a development certificate, which is why the Play-Protect prompt
   appears — tap "install anyway".
3. First run: sign in with your email, name the household, add each account and
   type its balance — a debt is a negative, like -11599 — and you are in.

Everything is written to SQLite on the phone first, so nothing waits for a
signal and nothing is lost offline.

## Syncing to a second phone

Sync is built but the database it talks to has to be created once, by you, from
the Supabase dashboard — see [`../supabase/README.md`](../supabase/README.md).
It is one paste into the SQL editor and one setting on the email template.

Until you do that, the app is local-only and says so: Home reads *Saved on this
phone*. Nothing else changes, and no figure is affected.

Afterwards, sign in and Home reads *Synced just now*. Settings then shows a
six-character invite code; the second phone signs in with its own email,
chooses **Join by invite**, and types it. Both phones then show the same
figures.

## What is in 0.2.0

The Postgres schema and its row-level security, the push/pull merge, real
sign-in by six-digit code, join-by-invite, and a sync line on Home that reports
what is actually true rather than a fixed sentence.

## Rebuilding

Built with `EXPO_PUBLIC_DEMO=0`, which is what makes it start empty rather than
with the ten rows the mockups were drawn against.

```bash
npm install
npx expo prebuild --platform android
cd android && EXPO_PUBLIC_DEMO=0 ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
```

To check you got the same build, the bundle inside the APK should hash to the
same value as the one gradle wrote:

```bash
unzip -p dist/SpendLogX-0.2.0-arm64.apk assets/index.android.bundle | md5sum
md5sum android/app/build/generated/assets/react/release/index.android.bundle
```
