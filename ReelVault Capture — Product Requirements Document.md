# ReelVault Capture — Product Requirements Document

**Document status:** Prototype PRD  
**Version:** 1.0  
**Prepared for:** ReelVault Capture  
**Prepared by:** Manus AI  
**Last updated:** 20 September 2026

## 1. Product summary

ReelVault Capture is an Android application for recording a user-controlled Instagram Reel browsing session for later personal review. The user selects an explicit recording duration, grants Android permissions one by one, opens Instagram, and manually or optionally accessibility-assisted scrolls through Reels while the app records the Android screen.

The product is intentionally designed as a **privacy-first capture utility**, not as an Instagram client. It must not log in to Instagram, scrape Instagram content, use private APIs, automate account actions, upload content automatically, or publish anything to Instagram. The user controls when recording starts, pauses, stops, and saves.

> **Core product promise:** Capture an Instagram Reel session for a selected period, locally and transparently, with visible controls and no automatic publishing.

The current project contains an interactive Expo mobile prototype and a source-implemented Android native bridge. The JavaScript interface, state flow, local session library, permission explanations, and native module wiring are implemented. A physical Android APK is still required to validate actual MediaProjection recording, foreground-service behavior, AccessibilityService gestures, encoder output, and device lifecycle behavior.

## 2. Problem statement

Users may encounter Reels that they want to revisit, compare, study, or archive for personal reference. A normal browsing session does not provide a simple, user-controlled way to preserve the entire viewing context. At the same time, a capture tool can become unsafe or misleading if it records without clear consent, hides its activity, captures private information without warning, or automates Instagram actions.

ReelVault Capture addresses this problem by providing a bounded recording session. It makes the recording window explicit, explains every sensitive permission, keeps recordings local by default, and gives the user visible controls throughout the session.

## 3. Goals and non-goals

### 3.1 Product goals

The product must:

1. Allow a user to configure and start a timed screen-capture session.
2. Request sensitive permissions through Android’s official permission and settings flows.
3. Display a visible countdown before recording begins.
4. Record the Android screen to an MP4 file using MediaProjection and a foreground service.
5. Provide Pause and Stop controls through the app and persistent notification.
6. Offer optional vertical swipe assistance through an explicitly enabled AccessibilityService.
7. Preserve all captured sessions unless the user explicitly deletes them.
8. Store session metadata locally and provide a searchable session library.
9. Explain that screen capture may include usernames, notifications, comments, messages, or other visible private information.
10. Prevent any automatic Instagram upload, sharing, liking, following, commenting, or publishing.

### 3.2 Non-goals

The prototype will not:

- implement Instagram login or credential storage;
- use Instagram private APIs, scraping, reverse engineering, or network interception;
- automate Like, Follow, Share, Comment, Save, messaging, login, or account-management actions;
- silently record in the background;
- bypass Android permission dialogs;
- classify or delete promotional content automatically by default;
- upload videos to ReelVault cloud without a separate future product decision and explicit user action;
- claim that a web preview can control the native Instagram application;
- guarantee compatibility with every Instagram version or Android device.

## 4. Target users and use cases

### 4.1 Primary user

The primary user is an Android user who wants to preserve a short Instagram Reel browsing session for private review. The user understands that screen recording captures whatever is visible on the device and is willing to grant permissions explicitly.

### 4.2 Representative use cases

**Personal review:** A user wants to revisit a set of Reels later without relying on Instagram’s changing feed.

**Research and comparison:** A user wants to compare several short-form videos as part of a personal study or content review workflow.

**Promotional-content preservation:** A user wants to keep sponsored or promotional Reels instead of losing them during a browsing session. The safe default is to preserve everything and let the user mark or delete sessions manually.

**Manual browsing:** A user records while scrolling Instagram normally. This mode must work even when AccessibilityService is not enabled.

**Optional swipe assistance:** A user explicitly enables the accessibility feature and asks the app to perform only a simple vertical swipe at a configurable interval.

## 5. Product principles

### Consent before capability

The app must explain the purpose of each sensitive permission before requesting it. Screen recording, microphone access, notifications, and AccessibilityService access must never be treated as silently available.

### Visibility during capture

The user must always know when recording is active. The foreground notification must remain visible, and a visible Stop control must be available.

### Local-first privacy

Recordings and metadata remain local by default. The app must not upload or publish anything automatically.

### Minimal automation

The optional AccessibilityService may perform only a controlled vertical swipe. It must not inspect or activate Instagram actions such as Like, Follow, Share, Comment, Save, login, or messaging.

### Safe preservation

The app must never delete a recording because it believes the content is promotional, irrelevant, or an advertisement. Preservation is the default; deletion requires an explicit user action.

### Honest capability reporting

If a capability has not been tested on a real Android device, the UI and documentation must describe it as pending device validation rather than pretending that the preview is a working recorder.

## 6. User experience and screen requirements

### 6.1 Welcome screen

The welcome screen must show the product name, a short explanation, and the privacy boundary. It must contain:

- **Start setup**;
- **Privacy and permissions**;
- a link to the local session library;
- a settings entry point;
- a statement that ReelVault Capture cannot upload or publish anything to Instagram automatically.

Recommended message:

> Capture Instagram Reel sessions for personal review with an explicit timer.

The screen must also explain that anything visible on the Android screen may be included in the recording.

### 6.2 Permission setup screen

The permission checklist must contain these items:

| Permission or access | Required status | Reason shown to the user | Android flow |
|---|---|---|---|
| Screen recording | Required to record | Captures the Android screen during the timed session | MediaProjection consent dialog |
| Microphone | Optional | Includes microphone audio when enabled | Runtime permission dialog |
| Notifications | Required for recording visibility on Android 13+ | Keeps the recording notification visible | Runtime permission dialog |
| AccessibilityService | Optional | Performs only the configured vertical swipe | Android Accessibility settings |
| Storage/media | Version-dependent | Used only when the selected save destination requires it | Scoped-storage or MediaStore flow |

Every item needs a status, explanation, action button, and failure or cancellation message. AccessibilityService must include a warning that it is powerful and should be enabled only for ReelVault Capture.

### 6.3 Session setup screen

The user must be able to configure:

- duration: 15 seconds, 30 seconds, 60 seconds, 2 minutes, or custom duration;
- microphone inclusion: on or off;
- auto-scroll assistance: on or off;
- scroll interval when auto-scroll is enabled;
- keep promotional content: on or off;
- save destination: local device or clearly labeled future cloud placeholder.

Before starting, the screen must show a summary containing duration, microphone state, scrolling state, scroll interval, and save destination.

### 6.4 Start flow

The start flow must perform the following sequence:

1. Validate the selected duration.
2. Request MediaProjection consent if it is not already available for the session.
3. Request microphone permission only when microphone capture is enabled.
4. Verify notification permission.
5. If auto-scroll is enabled and AccessibilityService is not enabled, explain the limitation and open Android Accessibility settings.
6. Attempt to open Instagram using the official Android intent/deep link.
7. If Instagram is unavailable, show an actionable fallback instead of silently failing.
8. Show a visible 3, 2, 1 countdown.
9. Begin recording only after consent and configuration are ready.

### 6.5 Recording screen

The recording screen must show:

- current state: preparing, recording, paused, or stopping;
- remaining time;
- a pulsing recording indicator or waveform-style visual feedback;
- Pause control;
- Stop control;
- scroll-assistance status when enabled;
- number of scroll actions;
- promotional markers when manually added.

The Android notification must contain the recording title and actions for Pause and Stop. The recording must stop automatically at the selected duration or immediately when the user presses Stop.

### 6.6 Promotion handling

The prototype must use conservative handling:

- preserve all captured content by default;
- provide a manual marker such as **Mark as promotional**;
- provide **Keep this Reel**, **Skip this Reel**, or equivalent user-controlled labeling only if the interaction is implemented without deleting content automatically;
- explain that OCR or visible-label detection, if added later, may be imperfect;
- never infer that a label is sufficient reason to delete content.

### 6.7 Result screen

After stopping, the result screen must show the available metadata:

- video preview when a native MP4 URI exists;
- duration;
- file size when available;
- timestamp;
- number of scroll actions;
- promotional marker count or status;
- local file status.

Actions must include Play, Rename, Mark as promotional, Save locally, Upload placeholder, and Delete. Upload must be clearly labeled as unavailable or future functionality until a cloud design is approved.

### 6.8 Session library

The local library must provide:

- session cards;
- date and duration;
- promotional marker;
- file-size display when available;
- search by name, duration, or timestamp;
- rename;
- playback when a native URI exists;
- delete confirmation;
- local storage count or usage indicator.

The current prototype persists metadata using AsyncStorage and deletes the native MP4 through the bridge when a native URI is present.

## 7. Functional requirements

| ID | Requirement | Priority | Acceptance condition |
|---|---|---:|---|
| FR-01 | The app displays a privacy-first welcome screen | Must | User can understand the purpose and limitations before setup |
| FR-02 | The app lists permission states individually | Must | Each permission shows status, explanation, and action |
| FR-03 | The app validates recording duration | Must | Invalid or unsupported duration cannot start a session |
| FR-04 | The app shows a countdown | Must | Countdown is visible before recording begins |
| FR-05 | The Android bridge requests MediaProjection consent | Must | Android system consent dialog appears in a custom APK |
| FR-06 | Recording uses a foreground service | Must | Persistent notification remains visible during capture |
| FR-07 | User can stop recording immediately | Must | Stop action ends capture and releases resources |
| FR-08 | User can pause and resume recording | Should | Notification and in-app controls reflect the state |
| FR-09 | Recording stops at the configured duration | Must | Session ends automatically at the timer boundary |
| FR-10 | Microphone is optional | Should | Audio permission is requested only when enabled |
| FR-11 | Auto-scroll is opt-in | Should | Only explicit vertical swipe assistance is performed |
| FR-12 | Manual browsing works without AccessibilityService | Must | Recording can proceed with auto-scroll disabled |
| FR-13 | Sessions persist locally | Must | Metadata remains after app reload |
| FR-14 | User can rename a session | Must | New name appears after saving |
| FR-15 | User can delete a session | Must | Confirmation is required and metadata/file are removed when possible |
| FR-16 | User can play a native recording | Should | MP4 opens when a valid URI exists |
| FR-17 | No automatic Instagram publishing occurs | Must | No upload/publish action is performed implicitly |
| FR-18 | Preview limitations are disclosed | Must | Web/preview mode does not claim to record Android or control Instagram |

## 8. Non-functional requirements

### Privacy and security

Recordings must be stored in an app-private location or an approved scoped-storage/MediaStore location. Metadata must not contain Instagram credentials. Logs must not contain screen contents, microphone audio, video content, or account details. Deletion must remove local metadata and delete the native file when the URI is available.

### Reliability

The recorder must release MediaProjection, VirtualDisplay, MediaRecorder, notification, and service resources on normal stop, timer completion, cancellation, encoder failure, and service shutdown. The app must display a recoverable error when a permission is denied or the recorder cannot start.

### Performance

The recorder should use a compatible H.264/MP4 configuration that does not block the UI thread. Timer updates and notification updates should be lightweight. The session library should remain responsive with at least several hundred local metadata records.

### Accessibility and usability

Primary controls must be labeled. Stop must be visually prominent. Color must not be the only indicator of recording state. Permission explanations must use plain language.

### Compatibility

The prototype should target Android versions supported by the Expo SDK and should explicitly validate Android 13–15 behavior, especially notification permission, foreground-service type declarations, MediaProjection consent, microphone capture, orientation changes, and process restarts.

## 9. Data model

A session record should contain:

```ts
type SessionRecord = {
  id: string;
  name?: string;
  createdAt: string;
  duration: number;
  uri?: string;
  fileSizeBytes?: number;
  scrollCount: number;
  promotional: boolean;
  promotionalMarkerCount?: number;
  saveDestination?: "local" | "cloud-placeholder";
};
```

Settings should contain:

```ts
type AppSettings = {
  defaultDuration: number;
  scrollSpeed: number;
  microphone: boolean;
  autoScroll: boolean;
  keepPromotional: boolean;
};
```

The current prototype stores settings and session metadata locally. A production Android implementation may move structured metadata to Room or DataStore, but the storage choice must not introduce cloud upload by default.

## 10. Privacy and consent copy

The app should present the following disclosure before recording:

> ReelVault Capture records the Android screen for the duration you choose. Anything visible may be included, including notifications, usernames, comments, messages, and private information. Do not open sensitive content while recording. Recordings stay local unless you explicitly choose a future sharing or upload action.

The AccessibilityService explanation should say:

> Optional swipe assistance uses Android AccessibilityService to perform only a vertical swipe gesture. It does not like, follow, share, comment, save, message, log in, or submit forms. You can record manually without enabling it.

## 11. Success metrics for the prototype

The prototype is successful when a new user can understand the privacy boundary, complete setup without guessing, configure a timer, see the countdown, identify the recording state, stop safely, and find the session in the local library.

For the native milestone, success additionally requires a real Android device test in which a recording produces a playable MP4, the foreground notification remains visible, Pause and Stop work, the timer ends the service, the MP4 URI is saved to metadata, and deletion removes both metadata and the file.

## 12. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Android denies MediaProjection or changes its behavior | Recording cannot start | Use official APIs, show a clear error, and validate across Android versions |
| Screen capture includes sensitive information | Privacy harm | Strong disclosure, local-first storage, visible recording state, and deletion controls |
| AccessibilityService is misunderstood | Excessive trust or platform-policy risk | Make it opt-in, explain the exact gesture, and prohibit account actions |
| Instagram changes its UI or intent handling | Launch or scrolling becomes unreliable | Keep manual mode fully functional and treat automation as experimental |
| Encoder fails on a device | Missing or corrupt video | Test codec profiles and handle cleanup and error states |
| Large recordings consume storage | Device storage pressure | Show storage usage, file size, and deletion controls |
| Preview creates false confidence | User believes native recording works | Display preview limitations and require APK/device validation |

## 13. Release scope

### Prototype release

The prototype includes the welcome flow, permission checklist, configuration controls, countdown, recording-state UI, settings, local session persistence, searchable library, rename, delete, playback action, native bridge source, foreground recording service source, and test coverage.

### Not release-ready until device validation

The following are not considered production-ready until tested on physical Android hardware:

- MediaProjection consent and output;
- microphone audio capture;
- foreground notification actions;
- pause/resume semantics;
- orientation changes;
- service shutdown and restart;
- AccessibilityService swipe behavior;
- MP4 playback and file deletion;
- Android 13–15 permission behavior.

## 14. Future decisions

The product owner must decide whether cloud upload is actually required. If it is approved, the design must specify authentication, encryption, retention, consent, deletion, upload progress, failure recovery, and whether recordings may contain third-party personal information.

The product owner must also decide whether promotion labeling remains manual or whether a compliant, explainable OCR-assisted label detector is worth adding. Automatic classification must not change the preservation-first default.

## 15. References

[1]: https://developer.android.com/media/grow/media-projection "Android MediaProjection documentation"

[2]: https://developer.android.com/develop/background-work/services/fgs "Android foreground services documentation"

[3]: https://developer.android.com/guide/topics/ui/accessibility/service "Android AccessibilityService documentation"

[4]: https://developer.android.com/training/permissions/requesting "Android runtime permission documentation"

[5]: https://docs.expo.dev/modules/autolinking/ "Expo Autolinking documentation"

[6]: https://docs.expo.dev/modules/native-module-tutorial/ "Expo native module tutorial"
