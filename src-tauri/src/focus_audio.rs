//! Suppress notification streams while a focus timer is running.
//!
//! Linux exposes application playback streams through the PulseAudio protocol,
//! including on PipeWire desktops. We only touch notification/event streams and
//! known messaging clients; media and communication roles remain audible.

#[cfg(target_os = "linux")]
mod imp {
    use std::{
        collections::HashMap,
        io::{BufRead, BufReader},
        process::{Child, Command, Stdio},
        sync::{
            atomic::{AtomicBool, Ordering},
            Arc, Mutex,
        },
    };

    #[derive(Clone, Debug, Default, PartialEq, Eq)]
    struct Stream {
        id: u32,
        muted: bool,
        role: String,
        application: String,
        binary: String,
        media_name: String,
    }

    fn value(line: &str) -> String {
        line.split_once('=')
            .map(|(_, value)| value.trim().trim_matches('"').to_lowercase())
            .unwrap_or_default()
    }

    fn parse_streams(output: &str) -> Vec<Stream> {
        let mut streams = Vec::new();
        let mut current: Option<Stream> = None;
        for line in output.lines() {
            let line = line.trim();
            if let Some(id) = line.strip_prefix("Sink Input #") {
                if let Some(stream) = current.take() {
                    streams.push(stream);
                }
                current = id.parse().ok().map(|id| Stream {
                    id,
                    ..Default::default()
                });
            } else if let Some(stream) = current.as_mut() {
                if let Some(muted) = line.strip_prefix("Mute: ") {
                    stream.muted = muted == "yes";
                } else if line.starts_with("media.role =") {
                    stream.role = value(line);
                } else if line.starts_with("application.name =") {
                    stream.application = value(line);
                } else if line.starts_with("application.process.binary =") {
                    stream.binary = value(line);
                } else if line.starts_with("media.name =") {
                    stream.media_name = value(line);
                }
            }
        }
        if let Some(stream) = current {
            streams.push(stream);
        }
        streams
    }

    fn known_messenger(value: &str) -> bool {
        let compact = value.replace([' ', '-', '_'], "");
        if compact.contains("qqmusic") {
            return false;
        }
        compact.contains("wechat")
            || compact.contains("weixin")
            || compact.contains("微信")
            || compact == "qq"
            || compact.contains("com.tencent.qq")
            || compact == "tim"
            || compact.contains("dingtalk")
            || compact.contains("dingding")
            || compact.contains("钉钉")
            || compact.contains("telegram")
            || compact.contains("discord")
            || compact.contains("slack")
    }

    fn should_mute(stream: &Stream) -> bool {
        if matches!(stream.role.as_str(), "phone" | "communication") {
            return false;
        }
        matches!(stream.role.as_str(), "event" | "notification")
            || stream.media_name.contains("notification")
            || stream.media_name.contains("event sound")
            || known_messenger(&stream.application)
            || known_messenger(&stream.binary)
    }

    fn pactl_command() -> Command {
        #[cfg(test)]
        if let Some(path) = std::env::var_os("TOMATO_TEST_PACTL") {
            return Command::new(path);
        }
        Command::new("pactl")
    }

    fn pactl(args: &[&str]) -> Option<std::process::Output> {
        pactl_command().env("LC_ALL", "C").args(args).output().ok()
    }

    fn reconcile(muted: &Mutex<HashMap<u32, bool>>) {
        let Some(output) = pactl(&["list", "sink-inputs"]).filter(|o| o.status.success()) else {
            return;
        };
        let streams = parse_streams(&String::from_utf8_lossy(&output.stdout));
        let mut remembered = muted.lock().unwrap_or_else(|e| e.into_inner());
        for stream in streams.into_iter().filter(should_mute) {
            if remembered.contains_key(&stream.id) {
                continue;
            }
            remembered.insert(stream.id, stream.muted);
            if !stream.muted {
                let _ = pactl(&["set-sink-input-mute", &stream.id.to_string(), "1"]);
            }
        }
    }

    fn restore(muted: &Mutex<HashMap<u32, bool>>) {
        let remembered = {
            let mut remembered = muted.lock().unwrap_or_else(|e| e.into_inner());
            std::mem::take(&mut *remembered)
        };
        for (id, was_muted) in remembered {
            if !was_muted {
                let _ = pactl(&["set-sink-input-mute", &id.to_string(), "0"]);
            }
        }
    }

    struct Inner {
        active: AtomicBool,
        muted: Mutex<HashMap<u32, bool>>,
        subscriber: Mutex<Option<Child>>,
    }

    #[derive(Clone)]
    pub struct FocusAudio {
        inner: Arc<Inner>,
    }

    impl FocusAudio {
        pub fn new() -> Self {
            let inner = Arc::new(Inner {
                active: AtomicBool::new(false),
                muted: Mutex::new(HashMap::new()),
                subscriber: Mutex::new(None),
            });
            if let Ok(mut child) = pactl_command()
                .arg("subscribe")
                .env("LC_ALL", "C")
                .stdout(Stdio::piped())
                .stderr(Stdio::null())
                .spawn()
            {
                if let Some(stdout) = child.stdout.take() {
                    let listener = inner.clone();
                    std::thread::spawn(move || {
                        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
                            if listener.active.load(Ordering::Relaxed)
                                && line.contains("sink-input")
                            {
                                reconcile(&listener.muted);
                            }
                        }
                    });
                }
                *inner.subscriber.lock().unwrap_or_else(|e| e.into_inner()) = Some(child);
            }
            Self { inner }
        }

        pub fn set_active(&self, active: bool) {
            let was_active = self.inner.active.swap(active, Ordering::Relaxed);
            let subscribed = self
                .inner
                .subscriber
                .lock()
                .unwrap_or_else(|e| e.into_inner())
                .as_mut()
                .is_some_and(|child| child.try_wait().is_ok_and(|status| status.is_none()));
            if active && (!was_active || !subscribed) {
                // Poll only as a fallback when event subscription is unavailable.
                reconcile(&self.inner.muted);
            } else if !active && was_active {
                restore(&self.inner.muted);
            }
        }

        pub fn stop(&self) {
            self.set_active(false);
            if let Some(mut child) = self
                .inner
                .subscriber
                .lock()
                .unwrap_or_else(|e| e.into_inner())
                .take()
            {
                let _ = child.kill();
                let _ = child.wait();
            }
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;
        use std::{fs, os::unix::fs::PermissionsExt, time::Duration};

        #[test]
        fn parses_notification_streams_and_preserves_calls_and_music() {
            let streams = parse_streams(
                r#"
Sink Input #21
    Mute: no
    Properties:
        application.name = "WeChat"
        application.process.binary = "wechat"
        media.name = "Playback Stream"
Sink Input #22
    Mute: yes
    Properties:
        application.name = "System Sounds"
        media.role = "event"
Sink Input #23
    Mute: no
    Properties:
        application.name = "QQ"
        media.role = "communication"
Sink Input #24
    Mute: no
    Properties:
        application.name = "Firefox"
        media.role = "music"
Sink Input #25
    Mute: no
    Properties:
        application.name = "com.tencent.qqmusic"
"#,
            );
            assert_eq!(streams.len(), 5);
            assert!(should_mute(&streams[0]));
            assert!(should_mute(&streams[1]));
            assert!(streams[1].muted);
            assert!(!should_mute(&streams[2]));
            assert!(!should_mute(&streams[3]));
            assert!(!should_mute(&streams[4]));
        }

        #[test]
        fn focus_mutes_new_notifications_and_restores_only_changed_streams() {
            let dir =
                std::env::temp_dir().join(format!("tomato-focus-audio-{}", std::process::id()));
            let _ = fs::remove_dir_all(&dir);
            fs::create_dir_all(&dir).unwrap();
            let script = dir.join("pactl");
            let log = dir.join("calls");
            fs::write(
                &script,
                r#"#!/bin/sh
if [ "$1" = subscribe ]; then
  while :; do sleep 1; done
elif [ "$1 $2" = "list sink-inputs" ]; then
  cat <<'EOF'
Sink Input #21
    Mute: no
    Properties:
        application.name = "WeChat"
Sink Input #22
    Mute: yes
    Properties:
        media.role = "event"
EOF
else
  printf '%s\n' "$*" >> "$TOMATO_FOCUS_AUDIO_LOG"
fi
"#,
            )
            .unwrap();
            fs::set_permissions(&script, fs::Permissions::from_mode(0o755)).unwrap();
            std::env::set_var("TOMATO_TEST_PACTL", &script);
            std::env::set_var("TOMATO_FOCUS_AUDIO_LOG", &log);

            let guard = FocusAudio::new();
            guard.set_active(true);
            guard.stop();

            let calls = fs::read_to_string(&log).unwrap();
            assert!(calls.contains("set-sink-input-mute 21 1"));
            assert!(calls.contains("set-sink-input-mute 21 0"));
            assert!(!calls.contains("set-sink-input-mute 22"));
            std::env::remove_var("TOMATO_TEST_PACTL");
            std::env::remove_var("TOMATO_FOCUS_AUDIO_LOG");
            std::thread::sleep(Duration::from_millis(20));
            fs::remove_dir_all(dir).unwrap();
        }
    }
}

#[cfg(target_os = "linux")]
pub use imp::FocusAudio;

#[cfg(not(target_os = "linux"))]
#[derive(Clone)]
pub struct FocusAudio;

#[cfg(not(target_os = "linux"))]
impl FocusAudio {
    pub fn new() -> Self {
        Self
    }
    pub fn set_active(&self, _active: bool) {}
    pub fn stop(&self) {}
}
