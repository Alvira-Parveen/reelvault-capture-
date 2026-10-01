import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ScreenContainer } from "@/components/screen-container";
import { deleteNativeRecording, getLastRecordingUri, isNativeCaptureAvailable, openAccessibilitySettings, requestMicrophonePermission, requestNotificationPermission, requestScreenCapture } from "@/modules/reelvault-capture";
import { deleteSession as deleteSessionRecord, renameSession, searchSessions } from "@/lib/session-library";

type Screen = "welcome" | "privacy" | "permissions" | "setup" | "countdown" | "recording" | "result" | "library";
type SessionRecord = { id: string; createdAt: string; duration: number; scrollCount: number; promotional: boolean; name?: string; uri?: string };
type AppSettings = { defaultDuration: number; scrollSpeed: number };

const SESSIONS_KEY = "reelvault.capture.sessions.v1";
const SETTINGS_KEY = "reelvault.capture.settings.v1";
type PermissionKey = "screenCapture" | "microphone" | "notifications" | "accessibility";

type Permission = {
  key: PermissionKey;
  title: string;
  detail: string;
  required: boolean;
  powerful?: boolean;
};

const permissions: Permission[] = [
  { key: "screenCapture", title: "Screen recording", detail: "Android MediaProjection captures only what is visible after you approve the system prompt.", required: true },
  { key: "microphone", title: "Microphone", detail: "Optional audio input. Keep it off unless you want microphone audio in the session.", required: false },
  { key: "notifications", title: "Notifications", detail: "Keeps recording controls visible in the Android notification shade.", required: true },
  { key: "accessibility", title: "Accessibility service", detail: "Optional experimental vertical swipe assistance. It never clicks Like, Follow, Share, Comment, or Save.", required: false, powerful: true },
];

const durationOptions = [15, 30, 60, 120];

export default function HomeScreen() {
  const [screen, setScreen] = useState<Screen>("welcome");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings>({ defaultDuration: 30, scrollSpeed: 8 });
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [sessionSaved, setSessionSaved] = useState(false);
  const [notice, setNotice] = useState("");
  const [config, setConfig] = useState({ duration: 30, microphone: false, autoScroll: false, scrollInterval: 8, keepPromotional: true });
  const [permissionState, setPermissionState] = useState<Record<PermissionKey, boolean>>({ screenCapture: false, microphone: false, notifications: false, accessibility: false });
  const [countdown, setCountdown] = useState(3);
  const [remaining, setRemaining] = useState(30);
  const [paused, setPaused] = useState(false);
  const [scrollCount, setScrollCount] = useState(0);
  const [recordedSeconds, setRecordedSeconds] = useState(0);
  const [search, setSearch] = useState("");

  const allRequiredReady = permissionState.screenCapture && permissionState.notifications;

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(SESSIONS_KEY), AsyncStorage.getItem(SETTINGS_KEY)]).then(([savedSessions, savedSettings]) => {
      if (savedSessions) setSessions(JSON.parse(savedSessions));
      if (savedSettings) {
        const nextSettings = JSON.parse(savedSettings) as AppSettings;
        setSettings(nextSettings);
        setConfig((current) => ({ ...current, duration: nextSettings.defaultDuration, scrollInterval: nextSettings.scrollSpeed }));
      }
    }).catch(() => showNotice("Saved preferences could not be loaded."));
  }, []);

  useEffect(() => {
    if (screen !== "result" || sessionSaved) return;
    let active = true;
    (async () => {
      const uri = isNativeCaptureAvailable() ? await getLastRecordingUri() : null;
      if (!active) return;
      const record: SessionRecord = { id: `${Date.now()}`, createdAt: new Date().toISOString(), duration: recordedSeconds, scrollCount, promotional: config.keepPromotional, uri: uri || undefined };
      const nextSessions = [record, ...sessions];
      setSessions(nextSessions);
      setSessionSaved(true);
      AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(nextSessions)).catch(() => showNotice("Session completed, but local library storage failed."));
    })().catch(() => showNotice("Session completed, but native file metadata could not be read."));
    return () => { active = false; };
  }, [screen, sessionSaved, recordedSeconds, scrollCount, config.keepPromotional, sessions]);

  useEffect(() => {
    if (screen !== "countdown") return;
    const timer = setInterval(() => {
      setCountdown((current) => {
        if (current <= 1) {
          clearInterval(timer);
          setRemaining(config.duration);
          setScreen("recording");
          return 3;
        }
        return current - 1;
      });
    }, 900);
    return () => clearInterval(timer);
  }, [screen, config.duration]);

  useEffect(() => {
    if (screen !== "recording" || paused) return;
    const timer = setInterval(() => {
      setRemaining((current) => {
        if (current <= 1) {
          clearInterval(timer);
          setRecordedSeconds(config.duration);
          setScreen("result");
          return 0;
        }
        setRecordedSeconds(config.duration - current + 1);
        return current - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [screen, paused, config.duration]);

  const showNotice = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(""), 3800);
  };

  const startCountdown = async () => {
    const notificationsGranted = await requestNotificationPermission();
    if (!notificationsGranted) { showNotice("Notification permission is required for visible Stop controls."); return; }
    setPermissionState((current) => ({ ...current, notifications: true }));
    if (config.microphone) {
      const microphoneGranted = await requestMicrophonePermission();
      if (!microphoneGranted) { showNotice("Microphone permission was not granted. Turn it off or allow access to continue."); return; }
      setPermissionState((current) => ({ ...current, microphone: true }));
    }
    if (isNativeCaptureAvailable()) {
      try { await requestScreenCapture(config.duration, config.microphone); setPermissionState((current) => ({ ...current, screenCapture: true })); }
      catch { showNotice("Screen recording permission was cancelled."); return; }
    } else if (!allRequiredReady) {
      setScreen("permissions");
      showNotice("Preview mode: required permissions are simulated. Build the Android APK for real MediaProjection consent.");
      return;
    }
    setSessionSaved(false);
    setCountdown(3);
    setScreen("countdown");
  };

  const stopRecording = () => {
    setRecordedSeconds(Math.max(1, config.duration - remaining));
    setScreen("result");
  };

  const saveSettings = (nextSettings: AppSettings) => {
    setSettings(nextSettings);
    setConfig((current) => ({ ...current, duration: nextSettings.defaultDuration, scrollInterval: nextSettings.scrollSpeed }));
    AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(nextSettings)).catch(() => showNotice("Settings could not be saved."));
    setSettingsOpen(false);
    showNotice("Settings saved for your next recording.");
  };
  const updateSessions = (nextSessions: SessionRecord[]) => {
    setSessions(nextSessions);
    AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(nextSessions)).catch(() => showNotice("Library changes could not be saved."));
  };

  const openInstagram = async () => {
    try {
      await Linking.openURL("instagram://app");
    } catch {
      showNotice("Instagram handoff is available only in the native Android build. This preview cannot control another app.");
    }
  };

  const handlePermission = async (key: PermissionKey) => {
    if (key === "microphone") { const granted = await requestMicrophonePermission(); setPermissionState((current) => ({ ...current, microphone: granted })); return; }
    if (key === "notifications") { const granted = await requestNotificationPermission(); setPermissionState((current) => ({ ...current, notifications: granted })); return; }
    if (key === "accessibility") { await openAccessibilitySettings(); showNotice("Accessibility settings opened. Enable ReelVault Capture only if you want swipe assistance."); return; }
    if (key === "screenCapture" && isNativeCaptureAvailable()) { try { await requestScreenCapture(config.duration, config.microphone); setPermissionState((current) => ({ ...current, screenCapture: true })); } catch { showNotice("Screen recording permission was cancelled."); } }
    else { setPermissionState((current) => ({ ...current, screenCapture: true })); showNotice("Preview status updated. The Android APK will show the real MediaProjection consent dialog."); }
  };

  const goBack = () => setScreen(screen === "privacy" || screen === "permissions" ? "welcome" : "setup");

  return (
    <ScreenContainer className="bg-background" edges={["top", "left", "right", "bottom"]}>
      <StatusBar style="dark" />
      <View style={styles.appShell}>
        <Header screen={screen} onBack={screen !== "welcome" && screen !== "library" ? goBack : undefined} onLibrary={() => setScreen("library")} onSettings={() => setSettingsOpen(true)} />
        {notice ? <View style={styles.notice}><MaterialIcons name="info-outline" size={17} color="#264A5A" /><Text style={styles.noticeText}>{notice}</Text></View> : null}
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {screen === "welcome" && <Welcome onStart={() => setScreen("permissions")} onPrivacy={() => setScreen("privacy")} onLibrary={() => setScreen("library")} />}
          {screen === "privacy" && <Privacy onBack={() => setScreen("welcome")} />}
          {screen === "permissions" && <Permissions state={permissionState} onToggle={handlePermission} onContinue={() => setScreen("setup")} onBack={() => setScreen("welcome")} allRequiredReady={allRequiredReady} />}
          {screen === "setup" && <Setup config={config} setConfig={setConfig} onStart={startCountdown} onBack={() => setScreen("permissions")} onInstagram={openInstagram} />}
          {screen === "countdown" && <Countdown value={countdown} onCancel={() => setScreen("setup")} />}
          {screen === "recording" && <Recording config={config} remaining={remaining} paused={paused} scrollCount={scrollCount} setPaused={setPaused} setScrollCount={setScrollCount} onStop={stopRecording} />}
          {screen === "result" && <Result seconds={recordedSeconds} scrollCount={scrollCount} onLibrary={() => setScreen("library")} onAgain={() => setScreen("setup")} onNotice={showNotice} />}
          {screen === "library" && <Library search={search} setSearch={setSearch} sessions={sessions} onSessionsChange={updateSessions} onNotice={showNotice} onBack={() => setScreen("welcome")} />}
        </ScrollView>
        {settingsOpen && <SettingsModal settings={settings} onSave={saveSettings} onClose={() => setSettingsOpen(false)} />}
      </View>
    </ScreenContainer>
  );
}

function Header({ screen, onBack, onLibrary, onSettings }: { screen: Screen; onBack?: () => void; onLibrary: () => void; onSettings: () => void }) {
  return <View style={styles.header}>
    <View style={styles.brandRow}>
      {onBack ? <Pressable onPress={onBack} hitSlop={12} style={styles.iconButton}><MaterialIcons name="arrow-back" size={22} color="#15232B" /></Pressable> : <View style={styles.logo}><Text style={styles.logoText}>RV</Text></View>}
      <View><Text style={styles.brandName}>ReelVault</Text><Text style={styles.brandSub}>CAPTURE</Text></View>
    </View>
    <View style={styles.headerActions}>{screen !== "library" && <Pressable onPress={onLibrary} style={styles.libraryLink}><MaterialIcons name="video-library" size={18} color="#5D4BD9" /><Text style={styles.libraryLinkText}>Library</Text></Pressable>}<Pressable onPress={onSettings} style={styles.settingsButton}><MaterialIcons name="settings" size={20} color="#5D4BD9" /></Pressable></View>
  </View>;
}

function Welcome({ onStart, onPrivacy, onLibrary }: { onStart: () => void; onPrivacy: () => void; onLibrary: () => void }) {
  return <View>
    <View style={styles.heroOrb}><MaterialIcons name="movie-filter" size={42} color="#FFFFFF" /></View>
    <Text style={styles.eyebrow}>PERSONAL REVIEW TOOL</Text>
    <Text style={styles.heroTitle}>Capture your Reel sessions, intentionally.</Text>
    <Text style={styles.heroBody}>A timed, privacy-first recorder for moments you want to revisit. You decide when it starts, what it captures, and when it stops.</Text>
    <View style={styles.trustCard}><TrustItem icon="timer" title="Explicit timer" detail="15 seconds to 2 minutes" /><TrustItem icon="lock" title="Local by default" detail="No automatic uploads" /><TrustItem icon="touch-app" title="You stay in control" detail="Visible Stop button" /></View>
    <PrimaryButton label="Start setup" icon="arrow-forward" onPress={onStart} />
    <SecondaryButton label="Privacy and permissions" icon="shield" onPress={onPrivacy} />
    <Pressable onPress={onLibrary} style={styles.textButton}><Text style={styles.textButtonLabel}>Browse session library</Text><MaterialIcons name="chevron-right" size={18} color="#5D4BD9" /></Pressable>
    <Text style={styles.disclaimer}>ReelVault Capture cannot upload or publish anything to Instagram automatically. It uses official Android permissions only.</Text>
  </View>;
}

function TrustItem({ icon, title, detail }: { icon: keyof typeof MaterialIcons.glyphMap; title: string; detail: string }) {
  return <View style={styles.trustItem}><View style={styles.miniIcon}><MaterialIcons name={icon} size={17} color="#5D4BD9" /></View><Text style={styles.trustTitle}>{title}</Text><Text style={styles.trustDetail}>{detail}</Text></View>;
}

function Privacy({ onBack }: { onBack: () => void }) {
  return <View><SectionKicker>PRIVACY PROMISE</SectionKicker><Text style={styles.pageTitle}>Your screen. Your decision.</Text><Text style={styles.pageIntro}>Screen recording is powerful, so ReelVault Capture explains every permission before the first session.</Text>
    <InfoCard icon="visibility" title="What may be captured" body="Anything visible while recording: notifications, usernames, comments, messages, and other private information on your screen." tone="warning" />
    <InfoCard icon="cloud-off" title="What we do not do" body="No Instagram login automation, private APIs, scraping, background recording, automatic publishing, or automatic cloud upload." />
    <InfoCard icon="delete-outline" title="Your controls" body="Stop, pause, preserve, mark, rename, save, or delete sessions yourself. Nothing is deleted automatically." />
    <SecondaryButton label="Back to welcome" icon="arrow-back" onPress={onBack} />
  </View>;
}

function Permissions({ state, onToggle, onContinue, onBack, allRequiredReady }: { state: Record<PermissionKey, boolean>; onToggle: (key: PermissionKey) => void; onContinue: () => void; onBack: () => void; allRequiredReady: boolean }) {
  return <View><SectionKicker>STEP 1 OF 2</SectionKicker><Text style={styles.pageTitle}>Permission checklist</Text><Text style={styles.pageIntro}>Grant only what you need. In the native Android build, each action opens the official Android consent dialog or settings page.</Text>
    {permissions.map((item) => <PermissionCard key={item.key} item={item} granted={state[item.key]} onToggle={() => onToggle(item.key)} />)}
    <View style={styles.previewNote}><MaterialIcons name="science" size={19} color="#5D4BD9" /><Text style={styles.previewNoteText}>Interactive preview mode: buttons simulate status changes. MediaProjection and AccessibilityService require a real Android APK.</Text></View>
    <PrimaryButton label={allRequiredReady ? "Continue to capture setup" : "Review required permissions"} icon="arrow-forward" onPress={onContinue} />
    <SecondaryButton label="Back" icon="arrow-back" onPress={onBack} />
  </View>;
}

function PermissionCard({ item, granted, onToggle }: { item: Permission; granted: boolean; onToggle: () => void }) {
  return <View style={[styles.permissionCard, granted && styles.permissionGranted]}><View style={styles.permissionIcon}><MaterialIcons name={granted ? "check" : item.powerful ? "admin-panel-settings" : "tune"} size={20} color={granted ? "#198A59" : "#5D4BD9"} /></View><View style={styles.permissionCopy}><View style={styles.rowBetween}><Text style={styles.cardTitle}>{item.title}</Text><Text style={[styles.status, granted ? styles.statusGranted : styles.statusPending]}>{granted ? "GRANTED" : item.required ? "REQUIRED" : "OPTIONAL"}</Text></View><Text style={styles.cardBody}>{item.detail}</Text>{item.powerful && <Text style={styles.powerWarning}>Powerful access — enable only for ReelVault Capture.</Text>}<Pressable onPress={onToggle} style={styles.smallButton}><Text style={styles.smallButtonText}>{granted ? "Review status" : "Open permission"}</Text><MaterialIcons name="open-in-new" size={14} color="#5D4BD9" /></Pressable></View></View>;
}

function Setup({ config, setConfig, onStart, onBack, onInstagram }: { config: { duration: number; microphone: boolean; autoScroll: boolean; scrollInterval: number; keepPromotional: boolean }; setConfig: (value: { duration: number; microphone: boolean; autoScroll: boolean; scrollInterval: number; keepPromotional: boolean }) => void; onStart: () => void; onBack: () => void; onInstagram: () => void }) {
  return <View><SectionKicker>STEP 2 OF 2</SectionKicker><Text style={styles.pageTitle}>Set up your session</Text><Text style={styles.pageIntro}>Choose the boundaries before opening Instagram. The default keeps all captured content safe.</Text><Text style={styles.fieldLabel}>RECORDING DURATION</Text><View style={styles.chipRow}>{durationOptions.map((value) => <Pressable key={value} onPress={() => setConfig({ ...config, duration: value })} style={[styles.chip, config.duration === value && styles.chipActive]}><Text style={[styles.chipText, config.duration === value && styles.chipTextActive]}>{value === 120 ? "2 min" : `${value}s`}</Text></Pressable>)}</View>
    <SettingRow icon="mic-none" title="Include microphone" detail="Optional audio input" value={config.microphone} onChange={(value) => setConfig({ ...config, microphone: value })} />
    <SettingRow icon="swipe" title="Auto-scroll assistance" detail="Experimental swipe-only control" value={config.autoScroll} onChange={(value) => setConfig({ ...config, autoScroll: value })} />
    {config.autoScroll && <View style={styles.intervalBox}><Text style={styles.fieldLabel}>SCROLL INTERVAL</Text><View style={styles.intervalRow}>{[5, 8, 12].map((value) => <Pressable key={value} onPress={() => setConfig({ ...config, scrollInterval: value })} style={[styles.intervalChip, config.scrollInterval === value && styles.intervalActive]}><Text style={styles.intervalText}>{value}s</Text></Pressable>)}</View><Text style={styles.helperText}>The service only performs a vertical swipe. It never clicks Instagram actions.</Text></View>}
    <SettingRow icon="bookmark" title="Keep promotional content" detail="Preserve everything by default" value={config.keepPromotional} onChange={(value) => setConfig({ ...config, keepPromotional: value })} />
    <View style={styles.destination}><View style={styles.destinationIcon}><MaterialIcons name="smartphone" size={20} color="#5D4BD9" /></View><View style={{ flex: 1 }}><Text style={styles.cardTitle}>Save destination</Text><Text style={styles.cardBody}>Local device · Cloud upload is a placeholder</Text></View><MaterialIcons name="check-circle" size={21} color="#198A59" /></View>
    <View style={styles.summary}><Text style={styles.summaryLabel}>SESSION SUMMARY</Text><Text style={styles.summaryTitle}>{config.duration === 120 ? "2 minutes" : `${config.duration} seconds`} · microphone {config.microphone ? "on" : "off"}</Text><Text style={styles.summaryBody}>All captured content preserved · {config.autoScroll ? `swipe every ${config.scrollInterval}s` : "manual scrolling"}</Text></View>
    <PrimaryButton label="Confirm and start" icon="play-arrow" onPress={onStart} />
    <SecondaryButton label="Open Instagram first" icon="open-in-new" onPress={onInstagram} />
    <SecondaryButton label="Back to permissions" icon="arrow-back" onPress={onBack} />
  </View>;
}

function SettingRow({ icon, title, detail, value, onChange }: { icon: keyof typeof MaterialIcons.glyphMap; title: string; detail: string; value: boolean; onChange: (value: boolean) => void }) {
  return <View style={styles.settingRow}><View style={styles.settingIcon}><MaterialIcons name={icon} size={20} color="#5D4BD9" /></View><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.cardBody}>{detail}</Text></View><Switch value={value} onValueChange={onChange} trackColor={{ false: "#D9DCE6", true: "#BDB5F6" }} thumbColor={value ? "#5D4BD9" : "#F8F8FB"} /></View>;
}

function SettingsModal({ settings, onSave, onClose }: { settings: AppSettings; onSave: (settings: AppSettings) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(settings);
  return <View style={styles.modalBackdrop}><View style={styles.settingsModal}><View style={styles.modalHeader}><View><SectionKicker>APP SETTINGS</SectionKicker><Text style={styles.modalTitle}>Recording defaults</Text></View><Pressable onPress={onClose} style={styles.modalClose}><MaterialIcons name="close" size={21} color="#24343C" /></Pressable></View><Text style={styles.fieldLabel}>DEFAULT RECORDING DURATION</Text><View style={styles.chipRow}>{durationOptions.map((value) => <Pressable key={value} onPress={() => setDraft({ ...draft, defaultDuration: value })} style={[styles.chip, draft.defaultDuration === value && styles.chipActive]}><Text style={[styles.chipText, draft.defaultDuration === value && styles.chipTextActive]}>{value === 120 ? "2 min" : `${value}s`}</Text></Pressable>)}</View><Text style={styles.fieldLabel}>DEFAULT AUTO-SCROLL SPEED</Text><Text style={styles.helperText}>Choose how often the optional swipe assistant advances to the next Reel.</Text><View style={styles.speedRow}>{[5, 8, 12, 15].map((value) => <Pressable key={value} onPress={() => setDraft({ ...draft, scrollSpeed: value })} style={[styles.speedChip, draft.scrollSpeed === value && styles.intervalActive]}><Text style={styles.intervalText}>{value}s</Text></Pressable>)}</View><View style={styles.settingsNotice}><MaterialIcons name="save" size={18} color="#5D4BD9" /><Text style={styles.previewNoteText}>Saved locally on this device and applied to the next session.</Text></View><PrimaryButton label="Save settings" icon="check" onPress={() => onSave(draft)} /><SecondaryButton label="Cancel" icon="close" onPress={onClose} /></View></View>;
}

function Countdown({ value, onCancel }: { value: number; onCancel: () => void }) {
  return <View style={styles.countdown}><View style={styles.countdownBadge}><Text style={styles.countdownBadgeText}>READY TO CAPTURE</Text></View><Text style={styles.countdownNumber}>{value}</Text><Text style={styles.countdownTitle}>Open Instagram now</Text><Text style={styles.countdownBody}>Screen recording begins after this countdown. You can stop at any time from the visible control.</Text><SecondaryButton label="Cancel session" icon="close" onPress={onCancel} /></View>;
}

function Recording({ config, remaining, paused, scrollCount, setPaused, setScrollCount, onStop }: { config: { duration: number; microphone: boolean; autoScroll: boolean; scrollInterval: number }; remaining: number; paused: boolean; scrollCount: number; setPaused: (value: boolean) => void; setScrollCount: (value: number) => void; onStop: () => void }) {
  const progress = Math.max(0, Math.min(1, remaining / config.duration));
  return <View><View style={styles.recordingHeader}><PulseIndicator paused={paused} /><Text style={styles.liveText}>{paused ? "PAUSED" : "RECORDING"}</Text><Text style={styles.recordingTime}>{formatTime(remaining)}</Text></View><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress * 100}%` }]} /></View><View style={styles.recordingCard}><Text style={styles.recordingTitle}>{paused ? "Session paused" : "Capture is active"}</Text><Text style={styles.recordingBody}>The animated waveform confirms that the session is alive. A persistent Android notification must remain visible while screen capture is active.</Text><Waveform paused={paused} /><View style={styles.recordingMeta}><Meta label="Target" value={config.duration === 120 ? "2 min" : `${config.duration}s`} /><Meta label="Scrolls" value={`${scrollCount}`} /><Meta label="Mic" value={config.microphone ? "On" : "Off"} /></View></View><View style={styles.nativeBanner}><MaterialIcons name="phone-android" size={20} color="#5D4BD9" /><Text style={styles.nativeBannerText}>Native bridge required for MediaProjection, MP4 encoding, and the Android foreground notification.</Text></View>{config.autoScroll && <Pressable onPress={() => setScrollCount(scrollCount + 1)} style={styles.scrollControl}><MaterialIcons name="swipe" size={21} color="#5D4BD9" /><Text style={styles.scrollControlText}>Simulate next Reel swipe · {config.scrollInterval}s interval</Text></Pressable>}<View style={styles.recordingActions}><Pressable onPress={() => setPaused(!paused)} style={styles.pauseButton}><MaterialIcons name={paused ? "play-arrow" : "pause"} size={23} color="#5D4BD9" /><Text style={styles.pauseText}>{paused ? "Resume" : "Pause"}</Text></Pressable><Pressable onPress={onStop} style={styles.stopButton}><MaterialIcons name="stop" size={23} color="#FFFFFF" /><Text style={styles.stopText}>Stop now</Text></Pressable></View></View>;
}

function PulseIndicator({ paused }: { paused: boolean }) { const scale = useRef(new Animated.Value(1)).current; useEffect(() => { if (paused) return; const loop = Animated.loop(Animated.sequence([Animated.timing(scale, { toValue: 1.45, duration: 650, easing: Easing.inOut(Easing.ease), useNativeDriver: true }), Animated.timing(scale, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.ease), useNativeDriver: true })])); loop.start(); return () => loop.stop(); }, [paused, scale]); return <Animated.View style={[styles.liveDot, { transform: [{ scale }], backgroundColor: paused ? "#B17415" : "#D7465D" }]} />; }
function Waveform({ paused }: { paused: boolean }) { return <View style={styles.waveform}>{[16, 28, 42, 23, 35, 48, 26, 39, 18, 32, 44, 22, 36, 27, 18, 31].map((height, index) => <Animated.View key={index} style={[styles.waveBar, { height: paused ? 7 : height, opacity: paused ? 0.45 : 0.9 }]} />)}</View>; }

function Meta({ label, value }: { label: string; value: string }) { return <View><Text style={styles.metaLabel}>{label}</Text><Text style={styles.metaValue}>{value}</Text></View>; }

function Result({ seconds, scrollCount, onLibrary, onAgain, onNotice }: { seconds: number; scrollCount: number; onLibrary: () => void; onAgain: () => void; onNotice: (message: string) => void }) {
  return <View><View style={styles.successIcon}><MaterialIcons name="check" size={30} color="#FFFFFF" /></View><SectionKicker>SESSION COMPLETE</SectionKicker><Text style={styles.pageTitle}>Your capture is ready</Text><Text style={styles.pageIntro}>This preview shows the result workflow. A native Android build will attach the real MP4 file and metadata here.</Text><View style={styles.previewPlaceholder}><MaterialIcons name="play-circle-outline" size={48} color="#A9A2E9" /><Text style={styles.previewTitle}>Video preview unavailable in preview mode</Text><Text style={styles.previewBody}>MediaProjection recording requires a real Android device.</Text></View><View style={styles.resultGrid}><Meta label="DURATION" value={seconds > 0 ? formatTime(seconds) : "Pending"} /><Meta label="SCROLL ACTIONS" value={`${scrollCount}`} /><Meta label="FILE SIZE" value="After native capture" /><Meta label="PROMOTIONS" value="Manual markers" /></View><PrimaryButton label="Open session library" icon="video-library" onPress={onLibrary} /><SecondaryButton label="Mark as promotional" icon="bookmark-border" onPress={() => onNotice("Manual promotion marker saved for the native session workflow.")} /><SecondaryButton label="Save locally" icon="save-alt" onPress={() => onNotice("Local save will be connected to Android MediaStore in the native bridge.")} /><SecondaryButton label="Record another session" icon="replay" onPress={onAgain} /></View>;
}

function Library({ search, setSearch, sessions, onSessionsChange, onNotice, onBack }: { search: string; setSearch: (value: string) => void; sessions: SessionRecord[]; onSessionsChange: (sessions: SessionRecord[]) => void; onNotice: (message: string) => void; onBack: () => void }) {
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const filtered = useMemo(() => searchSessions(sessions, search), [search, sessions]);
  const commitRename = () => {
    if (!renameId || !renameValue.trim()) return;
    onSessionsChange(renameSession(sessions, renameId, renameValue));
    setRenameId(null);
    setRenameValue("");
  };
  const deleteSession = (session: SessionRecord) => Alert.alert("Delete session?", "This removes the local session record and native video file.", [
    { text: "Cancel", style: "cancel" },
    { text: "Delete", style: "destructive", onPress: async () => { await deleteNativeRecording(session.uri); onSessionsChange(deleteSessionRecord(sessions, session.id)); } },
  ]);
  const playSession = async (session: SessionRecord) => {
    if (session.uri) await Linking.openURL(session.uri);
    else onNotice("Playback becomes available after the native Android recorder attaches the finalized MP4 URI.");
  };
  return (
    <View>
      <View style={styles.libraryHero}>
        <View><SectionKicker>LOCAL LIBRARY</SectionKicker><Text style={styles.pageTitle}>Your sessions</Text></View>
        <View style={styles.storagePill}><Text style={styles.storageText}>{sessions.length} saved</Text></View>
      </View>
      <Text style={styles.pageIntro}>Sessions are persisted locally across reloads. Recordings stay private until you choose to save, rename, play, or delete them.</Text>
      <View style={styles.searchBox}><MaterialIcons name="search" size={20} color="#7C8290" /><TextInput value={search} onChangeText={setSearch} placeholder="Search sessions" placeholderTextColor="#8C92A0" style={styles.searchInput} /></View>
      {filtered.length === 0 ? (
        <View style={styles.emptyState}><View style={styles.emptyIcon}><MaterialIcons name="video-library" size={28} color="#8B83E4" /></View><Text style={styles.emptyTitle}>{search ? "No matching sessions" : "No sessions yet"}</Text><Text style={styles.emptyBody}>{search ? "Try another search term." : "Your completed captures will appear here with duration, file size, promotional markers, and delete controls."}</Text><PrimaryButton label="Start a session" icon="play-arrow" onPress={onBack} /></View>
      ) : filtered.map((session) => (
        <View key={session.id} style={styles.sessionCard}>
          <View style={styles.sessionIcon}><MaterialIcons name="movie" size={20} color="#5D4BD9" /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{session.name || `${session.duration}s capture`}</Text>
            <Text style={styles.cardBody}>{new Date(session.createdAt).toLocaleString()} · {session.scrollCount} swipes</Text>
            <View style={styles.sessionActions}>
              <Pressable onPress={() => playSession(session)}><Text style={styles.sessionActionText}>▶ Play</Text></Pressable>
              <Pressable onPress={() => { setRenameId(session.id); setRenameValue(session.name || `${session.duration}s capture`); }}><Text style={styles.sessionActionText}>✎ Rename</Text></Pressable>
              <Pressable onPress={() => deleteSession(session)}><Text style={[styles.sessionActionText, { color: "#D7465D" }]}>⌫ Delete</Text></Pressable>
            </View>
          </View>
          <MaterialIcons name={session.promotional ? "bookmark" : "bookmark-border"} size={20} color={session.promotional ? "#5D4BD9" : "#9EA4AD"} />
        </View>
      ))}
      {renameId && <View style={styles.renameBox}><Text style={styles.cardTitle}>Rename session</Text><TextInput value={renameValue} onChangeText={setRenameValue} autoFocus style={styles.renameInput} /><View style={styles.renameActions}><Pressable onPress={() => setRenameId(null)}><Text style={styles.secondaryText}>Cancel</Text></Pressable><Pressable onPress={commitRename}><Text style={styles.primarySmallText}>Save name</Text></Pressable></View></View>}
      <SecondaryButton label="Back to welcome" icon="arrow-back" onPress={onBack} />
    </View>
  );
}

function SectionKicker({ children }: { children: string }) { return <Text style={styles.sectionKicker}>{children}</Text>; }
function InfoCard({ icon, title, body, tone }: { icon: keyof typeof MaterialIcons.glyphMap; title: string; body: string; tone?: "warning" }) { return <View style={[styles.infoCard, tone === "warning" && styles.warningCard]}><View style={styles.infoIcon}><MaterialIcons name={icon} size={21} color={tone === "warning" ? "#A16A13" : "#5D4BD9"} /></View><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.cardBody}>{body}</Text></View></View>; }
function PrimaryButton({ label, icon, onPress }: { label: string; icon: keyof typeof MaterialIcons.glyphMap; onPress: () => void }) { return <Pressable onPress={onPress} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}><Text style={styles.primaryText}>{label}</Text><MaterialIcons name={icon} size={19} color="#FFFFFF" /></Pressable>; }
function SecondaryButton({ label, icon, onPress }: { label: string; icon: keyof typeof MaterialIcons.glyphMap; onPress: () => void }) { return <Pressable onPress={onPress} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}><MaterialIcons name={icon} size={18} color="#5D4BD9" /><Text style={styles.secondaryText}>{label}</Text></Pressable>; }
function formatTime(totalSeconds: number) { const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0"); const seconds = Math.max(0, totalSeconds % 60).toString().padStart(2, "0"); return `${minutes}:${seconds}`; }

const styles = StyleSheet.create({
  appShell: { flex: 1, backgroundColor: "#F8F7FC" },
  header: { minHeight: 72, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#F8F7FC" },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  logo: { width: 37, height: 37, borderRadius: 12, backgroundColor: "#5D4BD9", alignItems: "center", justifyContent: "center" },
  logoText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800", letterSpacing: -0.4 },
  brandName: { color: "#15232B", fontSize: 17, fontWeight: "800", letterSpacing: -0.2 },
  brandSub: { color: "#5D4BD9", fontSize: 9, fontWeight: "800", letterSpacing: 2.2, marginTop: 1 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  settingsButton: { width: 34, height: 34, borderRadius: 11, backgroundColor: "#EEECFF", alignItems: "center", justifyContent: "center" },
  iconButton: { width: 37, height: 37, borderRadius: 12, backgroundColor: "#ECEAF8", alignItems: "center", justifyContent: "center", marginRight: 2 },
  libraryLink: { flexDirection: "row", gap: 5, alignItems: "center", paddingVertical: 8, paddingHorizontal: 4 },
  libraryLinkText: { color: "#5D4BD9", fontWeight: "700", fontSize: 13 },
  notice: { marginHorizontal: 20, marginBottom: 8, padding: 12, borderRadius: 13, backgroundColor: "#E7F3F8", flexDirection: "row", gap: 8, alignItems: "flex-start" },
  noticeText: { color: "#264A5A", fontSize: 12, lineHeight: 17, flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 38 },
  heroOrb: { width: 84, height: 84, borderRadius: 28, backgroundColor: "#5D4BD9", alignItems: "center", justifyContent: "center", marginTop: 18, marginBottom: 26, shadowColor: "#5D4BD9", shadowOpacity: 0.22, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 5 },
  eyebrow: { color: "#5D4BD9", fontSize: 11, fontWeight: "800", letterSpacing: 1.7, marginBottom: 10 },
  heroTitle: { color: "#15232B", fontSize: 36, lineHeight: 41, fontWeight: "800", letterSpacing: -1.2, maxWidth: 360 },
  heroBody: { color: "#68727A", fontSize: 16, lineHeight: 24, marginTop: 16, maxWidth: 360 },
  trustCard: { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 16, marginTop: 25, marginBottom: 22, borderWidth: 1, borderColor: "#E9E7F3", gap: 15 },
  trustItem: { flexDirection: "row", alignItems: "center" },
  miniIcon: { width: 31, height: 31, borderRadius: 10, backgroundColor: "#F0EEFE", alignItems: "center", justifyContent: "center", marginRight: 10 },
  trustTitle: { color: "#24343C", fontWeight: "700", fontSize: 13, width: 102 },
  trustDetail: { color: "#7C848C", fontSize: 12, flex: 1 },
  primaryButton: { minHeight: 55, borderRadius: 16, backgroundColor: "#5D4BD9", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 9, shadowColor: "#5D4BD9", shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 3 },
  primaryText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  secondaryButton: { minHeight: 50, borderRadius: 15, borderWidth: 1, borderColor: "#DCD9F5", backgroundColor: "#FFFFFF", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, marginTop: 10 },
  secondaryText: { color: "#5142C5", fontSize: 14, fontWeight: "700" },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  textButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 2, paddingVertical: 18 },
  textButtonLabel: { color: "#5D4BD9", fontSize: 13, fontWeight: "700" },
  disclaimer: { textAlign: "center", color: "#8A9198", fontSize: 11, lineHeight: 16, paddingHorizontal: 16, marginTop: 6 },
  sectionKicker: { color: "#5D4BD9", fontSize: 11, fontWeight: "800", letterSpacing: 1.7, marginTop: 15, marginBottom: 9 },
  pageTitle: { color: "#15232B", fontSize: 30, lineHeight: 36, fontWeight: "800", letterSpacing: -0.7 },
  pageIntro: { color: "#68727A", fontSize: 15, lineHeight: 22, marginTop: 10, marginBottom: 18 },
  infoCard: { flexDirection: "row", gap: 12, padding: 15, borderRadius: 17, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E9E7F3", marginBottom: 11 },
  warningCard: { backgroundColor: "#FFF9ED", borderColor: "#F2DDA7" },
  infoIcon: { width: 37, height: 37, borderRadius: 12, backgroundColor: "#F0EEFE", alignItems: "center", justifyContent: "center" },
  cardTitle: { color: "#24343C", fontSize: 14, fontWeight: "800", lineHeight: 19 },
  cardBody: { color: "#727C84", fontSize: 12, lineHeight: 18, marginTop: 3 },
  permissionCard: { flexDirection: "row", gap: 11, padding: 14, borderRadius: 17, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E9E7F3", marginBottom: 10 },
  permissionGranted: { borderColor: "#B9E6D0", backgroundColor: "#F4FCF7" },
  permissionIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: "#F0EEFE", alignItems: "center", justifyContent: "center" },
  permissionCopy: { flex: 1 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  status: { fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  statusGranted: { color: "#198A59" },
  statusPending: { color: "#B17415" },
  powerWarning: { color: "#A16A13", fontSize: 11, lineHeight: 16, marginTop: 6 },
  smallButton: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 5, marginTop: 9 },
  smallButtonText: { color: "#5D4BD9", fontSize: 12, fontWeight: "800" },
  previewNote: { flexDirection: "row", gap: 9, padding: 13, borderRadius: 14, backgroundColor: "#EEECFF", marginTop: 3, marginBottom: 5 },
  previewNoteText: { color: "#5142C5", fontSize: 11, lineHeight: 16, flex: 1 },
  fieldLabel: { color: "#818994", fontSize: 10, fontWeight: "800", letterSpacing: 1.2, marginTop: 5, marginBottom: 10 },
  chipRow: { flexDirection: "row", gap: 8, marginBottom: 15 },
  chip: { flex: 1, minHeight: 43, borderRadius: 13, borderWidth: 1, borderColor: "#E0DDEE", backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  chipActive: { backgroundColor: "#5D4BD9", borderColor: "#5D4BD9" },
  chipText: { color: "#5B6470", fontSize: 13, fontWeight: "700" },
  chipTextActive: { color: "#FFFFFF" },
  settingRow: { minHeight: 68, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 16, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E9E7F3", marginBottom: 10 },
  settingIcon: { width: 35, height: 35, borderRadius: 11, backgroundColor: "#F0EEFE", alignItems: "center", justifyContent: "center" },
  intervalBox: { padding: 14, borderRadius: 15, backgroundColor: "#F2F0FF", marginTop: -3, marginBottom: 10 },
  intervalRow: { flexDirection: "row", gap: 8 },
  intervalChip: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10, backgroundColor: "#FFFFFF" },
  intervalActive: { backgroundColor: "#D9D3FF" },
  intervalText: { color: "#5142C5", fontWeight: "700", fontSize: 12 },
  helperText: { color: "#6D6A86", fontSize: 11, lineHeight: 16, marginTop: 9 },
  destination: { minHeight: 67, flexDirection: "row", alignItems: "center", gap: 11, padding: 13, borderRadius: 16, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E9E7F3", marginBottom: 15 },
  destinationIcon: { width: 35, height: 35, borderRadius: 11, backgroundColor: "#F0EEFE", alignItems: "center", justifyContent: "center" },
  summary: { padding: 15, borderRadius: 17, backgroundColor: "#EDEBFF", marginBottom: 8 },
  summaryLabel: { color: "#6258B9", fontSize: 10, fontWeight: "800", letterSpacing: 1.2 },
  summaryTitle: { color: "#302A76", fontSize: 15, fontWeight: "800", marginTop: 6 },
  summaryBody: { color: "#625C8B", fontSize: 12, marginTop: 4 },
  countdown: { alignItems: "center", paddingTop: 55 },
  countdownBadge: { borderRadius: 20, paddingHorizontal: 13, paddingVertical: 7, backgroundColor: "#EDEBFF" },
  countdownBadgeText: { color: "#5D4BD9", fontSize: 10, fontWeight: "800", letterSpacing: 1.1 },
  countdownNumber: { color: "#5D4BD9", fontSize: 120, lineHeight: 145, fontWeight: "800", marginTop: 20 },
  countdownTitle: { color: "#15232B", fontSize: 24, fontWeight: "800" },
  countdownBody: { color: "#68727A", fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 9, maxWidth: 300, marginBottom: 25 },
  recordingHeader: { flexDirection: "row", alignItems: "center", paddingTop: 14, paddingBottom: 13 },
  liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: "#D7465D", marginRight: 7 },
  liveText: { color: "#D7465D", fontSize: 11, fontWeight: "800", letterSpacing: 1.4 },
  recordingTime: { marginLeft: "auto", color: "#15232B", fontSize: 22, fontWeight: "800", letterSpacing: 1 },
  progressTrack: { height: 7, backgroundColor: "#E7E5EF", borderRadius: 4, overflow: "hidden" },
  progressFill: { height: 7, backgroundColor: "#5D4BD9", borderRadius: 4 },
  recordingCard: { padding: 18, borderRadius: 20, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E9E7F3", marginTop: 18 },
  recordingTitle: { color: "#15232B", fontSize: 24, fontWeight: "800" },
  recordingBody: { color: "#68727A", fontSize: 13, lineHeight: 19, marginTop: 7 },
  waveform: { height: 56, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, backgroundColor: "#F5F3FF", borderRadius: 14, marginTop: 16, paddingHorizontal: 15 },
  waveBar: { width: 5, borderRadius: 3, backgroundColor: "#6E5BE2" },
  recordingMeta: { flexDirection: "row", justifyContent: "space-between", marginTop: 23, paddingTop: 15, borderTopWidth: 1, borderTopColor: "#F0EEF6" },
  metaLabel: { color: "#8A9198", fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },
  metaValue: { color: "#24343C", fontSize: 15, fontWeight: "800", marginTop: 4 },
  nativeBanner: { flexDirection: "row", gap: 9, padding: 13, borderRadius: 14, backgroundColor: "#EEECFF", marginTop: 12 },
  nativeBannerText: { color: "#5142C5", fontSize: 11, lineHeight: 16, flex: 1 },
  scrollControl: { flexDirection: "row", alignItems: "center", gap: 8, padding: 13, borderRadius: 14, borderWidth: 1, borderColor: "#DDD9F7", marginTop: 11 },
  scrollControlText: { color: "#5142C5", fontWeight: "700", fontSize: 12, flex: 1 },
  recordingActions: { flexDirection: "row", gap: 10, marginTop: 18 },
  pauseButton: { flex: 1, minHeight: 54, borderRadius: 16, backgroundColor: "#EEECFF", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  pauseText: { color: "#5142C5", fontWeight: "800", fontSize: 14 },
  stopButton: { flex: 1, minHeight: 54, borderRadius: 16, backgroundColor: "#D7465D", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  stopText: { color: "#FFFFFF", fontWeight: "800", fontSize: 14 },
  successIcon: { width: 56, height: 56, borderRadius: 19, backgroundColor: "#198A59", alignItems: "center", justifyContent: "center", marginTop: 17, marginBottom: 10 },
  previewPlaceholder: { minHeight: 170, borderRadius: 19, backgroundColor: "#25243D", alignItems: "center", justifyContent: "center", padding: 20, marginBottom: 14 },
  previewTitle: { color: "#FFFFFF", fontSize: 14, fontWeight: "800", marginTop: 10, textAlign: "center" },
  previewBody: { color: "#C8C5DD", fontSize: 12, textAlign: "center", marginTop: 5 },
  resultGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 16, padding: 16, borderRadius: 17, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E9E7F3", marginBottom: 7 },
  libraryHero: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  storagePill: { borderRadius: 20, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: "#EDEBFF", marginBottom: 5 },
  storageText: { color: "#5142C5", fontSize: 11, fontWeight: "800" },
  searchBox: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: "#E0DDEE", backgroundColor: "#FFFFFF", flexDirection: "row", alignItems: "center", paddingHorizontal: 13, gap: 8, marginBottom: 20 },
  searchInput: { flex: 1, color: "#24343C", fontSize: 13 },
  emptyState: { borderRadius: 20, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E9E7F3", padding: 23, alignItems: "center", marginBottom: 8 },
  emptyIcon: { width: 62, height: 62, borderRadius: 21, backgroundColor: "#EEECFF", alignItems: "center", justifyContent: "center", marginBottom: 13 },
  emptyTitle: { color: "#24343C", fontSize: 18, fontWeight: "800" },
  emptyBody: { color: "#7A838B", fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 7, marginBottom: 9 },
  modalBackdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(21, 23, 31, 0.42)", justifyContent: "flex-end" },
  settingsModal: { backgroundColor: "#F8F7FC", borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, paddingBottom: 28 },
  modalHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  modalTitle: { color: "#15232B", fontSize: 25, fontWeight: "800", marginBottom: 16 },
  modalClose: { width: 35, height: 35, borderRadius: 12, backgroundColor: "#E9E7F3", alignItems: "center", justifyContent: "center" },
  speedRow: { flexDirection: "row", gap: 8, marginBottom: 15 },
  speedChip: { flex: 1, paddingVertical: 11, borderRadius: 11, backgroundColor: "#FFFFFF", alignItems: "center" },
  settingsNotice: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 13, backgroundColor: "#EEECFF", marginBottom: 2 },
  sessionCard: { minHeight: 70, flexDirection: "row", alignItems: "center", gap: 11, padding: 13, borderRadius: 16, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E9E7F3", marginBottom: 10 },
  sessionIcon: { width: 37, height: 37, borderRadius: 12, backgroundColor: "#EEECFF", alignItems: "center", justifyContent: "center" },
  sessionActions: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 8 },
  sessionActionText: { color: "#5D4BD9", fontSize: 11, fontWeight: "800" },
  renameBox: { padding: 14, borderRadius: 16, backgroundColor: "#EEECFF", marginBottom: 10 },
  renameInput: { minHeight: 43, backgroundColor: "#FFFFFF", borderRadius: 11, paddingHorizontal: 12, color: "#24343C", marginTop: 9 },
  renameActions: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 20, marginTop: 12 },
  primarySmallText: { color: "#5D4BD9", fontSize: 13, fontWeight: "800" },
});
