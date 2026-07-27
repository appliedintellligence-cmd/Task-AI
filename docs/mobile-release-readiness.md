# Mobile release readiness

## Supabase Auth redirects

Task AI uses the Expo application scheme `taskai` and handles Supabase Auth
callbacks inside the app. Add these exact entries to the staging and production
Supabase **Authentication → URL Configuration → Redirect URLs** allow-list:

- `taskai://auth/callback`
- `taskai://auth/callback?flow=recovery`

Email signup confirmation uses the first URL. Password recovery uses the
second. Keep the existing web redirect URLs as separate entries. No Supabase
dashboard setting is changed by repository code.

Before an internal build, verify both links on a physical iOS and Android
device: confirmation should establish a session and open the signed-in app;
recovery should establish a recovery session and open the new-password screen.
Expired, incomplete, and invalid callbacks must not establish a session.

## Required public build variables

Configure these through the intended EAS environment/profile; do not commit
their values:

- `EXPO_PUBLIC_API_URL`: Render staging API origin for internal staging builds
- `EXPO_PUBLIC_SUPABASE_URL`: Supabase staging project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`: Supabase staging anon key

The Supabase service-role key, Replicate token, and other backend secrets must
remain server-only.

## Apple submission identifiers

`mobile/eas.json` deliberately leaves `ascAppId` and `appleTeamId` empty. Their
absence does not prevent local Expo development or internal EAS builds; they
are required when configuring automated App Store submission.

- Obtain `ascAppId` from **App Store Connect → Apps → task.ai → App
  Information → Apple ID** after creating the app record.
- Obtain `appleTeamId` from **Apple Developer → Membership details → Team ID**.

Set both only after confirming the App Store Connect record and Apple team.
Do not guess or copy identifiers from another application.

## Google Play submission

Internal Android EAS builds do not require Google Play submission credentials.
For Play Store submission, create the application record for
`com.taskai.app`, configure Play App Signing, create a least-privilege Google
Play service account, grant it access to this app, and configure its JSON key
through EAS secrets/credentials. Do not commit the service-account JSON.

## Internal build gate

Before running an internal EAS build:

1. Add the Supabase redirect allow-list entries above.
2. Configure the three public staging variables.
3. Run TypeScript, mobile tests, `expo install --check`, and Expo config.
4. Verify login, logout, signup confirmation, password recovery, camera, photo
   picker, diagnosis, private history photos, and repaired previews on device.
5. Confirm the Render staging `/inpaint` endpoint rejects missing/invalid tokens
   and cross-user job/photo references.
