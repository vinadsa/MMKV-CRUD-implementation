# MMKV Chat Demo

Simple one-on-one chat built with Expo Router, Firebase Authentication, Firestore, and MMKV for instant local persistence.

## Features

- Email/password auth with auto-login (credentials + user profile cached via MMKV)
- Realtime thread list (`threads` collection) ordered by latest activity
- Deterministic 1:1 threads (sorted `uid_uid` identifiers) to avoid duplicates
- Chat room with realtime message stream, optimistic scroll-to-bottom, and basic read tracking (`readBy` contains sender by default)
- Quick “start chat by email” input so you can message any registered user

## Project structure

- `app/home.tsx` – chat list + new chat launcher
- `app/chat/[threadId].tsx` – message room UI
- `src/services/firebaseService.ts` – auth helpers, user profile utilities, realtime thread/message APIs
- `src/storage` – MMKV helpers and `AuthContext` (wraps the app in `_layout.tsx`)

### Firestore data model

```
users/{uid}
  displayName, email, emailLower, lastSeen

threads/{uidA_uidB}
  participants: [uidA, uidB]
  lastMessage, lastSenderId, createdAt, updatedAt

threads/{uidA_uidB}/messages/{autoId}
  text, senderId, createdAt, readBy
```

> Make sure Firestore rules only allow participants to read/write their threads/messages.

Recommended composite index: `threads` on (`participants`, array-contains) + `updatedAt` descending for the thread list query used in `subscribeToThreads`.

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Configure Firebase:
   - Update `src/firebaseConfig.ts` with your project keys
   - Enable Email/Password auth in Firebase console
   - Create Firestore database in **Native** mode

3. Start the Expo dev server:

   ```bash
   npx expo start
   ```

4. Register two accounts (via the Register screen) on real devices or simulators, then use the email field on the Home screen to start chatting.

## Useful scripts

- `npm run start` – start Expo dev server
- `npm run android` / `npm run ios` – build + run on device/simulator
- `npm run web` – run in the browser
- `npm run reset-project` – revert to a blank Expo Router project (use with caution)

## Troubleshooting

- **Realtime data not updating**: verify Firestore security rules and indexes, then reload the app.
- **Cannot find user by email**: ensure the user registered through the app (so `emailLower` is stored) and type the email exactly.
- **Stuck on splash**: clear cached credentials via the device settings or reinstall the app; MMKV may still hold invalid login data.
