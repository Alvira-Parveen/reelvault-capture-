# ReelVault Capture — Native Android Bridge

## Implemented in this checkpoint

- A local Expo native module at `modules/reelvault-capture`.
- Android `MediaProjectionManager` consent request.
- Android `FOREGROUND_SERVICE_MEDIA_PROJECTION` and microphone permission declarations.
- Foreground `RecordingService` with a persistent notification, Pause, Stop, H.264/MP4 `MediaRecorder`, `VirtualDisplay`, timer stop, and resource cleanup.
- Real Android runtime requests for microphone and Android 13+ notifications.
- Accessibility settings handoff through Android system settings.
- Config plugin registration for the recording service and Android permissions.
- Library session rename, delete confirmation, playback action when a native MP4 URI is present, and AsyncStorage metadata persistence.

## Native build and validation requirements

This session can type-check and preview the JavaScript/TypeScript layer, but it does not have an Android SDK, Gradle, emulator, or device. The following must be validated by producing a custom Android build:

1. Run Expo prebuild/EAS or Android Studio so the local module and config plugin are compiled into the APK.
2. Confirm the MediaProjection consent dialog appears only after the user starts a session.
3. Confirm the foreground notification remains visible and its Pause/Stop actions work.
4. Confirm the output MP4 is playable and the finalized URI is connected to the session metadata.
5. Validate Android 13–15 notification, microphone, orientation, lifecycle, encoder, and service-restart behavior.
6. Validate AccessibilityService enablement and ensure only the explicit vertical swipe is performed.

## Truthfulness boundary

The Expo preview cannot screen-capture Android or control Instagram. On preview/web, permission actions show safe fallback messaging and session playback explains that a native MP4 URI is required. The Android bridge is source-implemented but is not claimed as device-tested until a real APK is installed and exercised on Android hardware.
