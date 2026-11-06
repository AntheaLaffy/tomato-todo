//! HTTP Bearer token：runtime 生成后写入 guard 数据目录，guard 只读；
//! 缺失时 guard 自行生成（0600），以便 runtime 从同一路径取用。
use std::fs::OpenOptions;
use std::io::Write;
use std::path::{Path, PathBuf};

/// 默认数据目录：`$XDG_DATA_HOME/studio.tomato.todo/guard`，
/// 无 XDG_DATA_HOME 时回落到 `~/.local/share/studio.tomato.todo/guard`（沿袭旧应用路径）。
pub fn default_data_dir() -> PathBuf {
    let base = std::env::var_os("XDG_DATA_HOME")
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)
        .or_else(|| {
            std::env::var_os("HOME")
                .filter(|value| !value.is_empty())
                .map(|home| PathBuf::from(home).join(".local").join("share"))
        });
    match base {
        Some(base) => base.join("studio.tomato.todo").join("guard"),
        None => PathBuf::from(".tomato-guard"),
    }
}

pub fn token_file(data_dir: &Path) -> PathBuf {
    data_dir.join("token")
}

/// 读取 token 文件；不存在或为空时生成随机 token 并写入（unix 权限 0600）。
pub fn load_or_create(data_dir: &Path) -> std::io::Result<String> {
    std::fs::create_dir_all(data_dir)?;
    let path = token_file(data_dir);
    if let Ok(existing) = std::fs::read_to_string(&path) {
        let token = existing.trim();
        if !token.is_empty() {
            return Ok(token.to_string());
        }
    }
    let token = random_token();
    let mut options = OpenOptions::new();
    options.write(true).create(true).truncate(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut file = options.open(&path)?;
    file.write_all(token.as_bytes())?;
    Ok(token)
}

fn random_token() -> String {
    // 优先真随机（/dev/urandom，32 字节 → 64 位十六进制）。
    if let Ok(mut random) = std::fs::File::open("/dev/urandom") {
        use std::io::Read;
        let mut bytes = [0u8; 32];
        if random.read_exact(&mut bytes).is_ok() {
            return bytes.iter().map(|byte| format!("{byte:02x}")).collect();
        }
    }
    // 兜底：时间戳与 PID 的线性同余伪随机（仅在没有 /dev/urandom 的环境）。
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or(0);
    let mut state = now ^ (u128::from(std::process::id()) << 32) | 1;
    let mut out = String::with_capacity(64);
    for _ in 0..32 {
        state = state
            .wrapping_mul(6364136223846793005)
            .wrapping_add(1442695040888963407);
        out.push_str(&format!("{:02x}", (state >> 64) as u8));
    }
    out
}

/// 恒时风格比较：先比长度，再逐字节异或累加，避免短路泄露前缀。
pub fn matches(supplied: Option<&str>, expected: &str) -> bool {
    let Some(supplied) = supplied else { return false };
    let (a, b) = (supplied.as_bytes(), expected.as_bytes());
    if a.len() != b.len() {
        return false;
    }
    a.iter().zip(b).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn token_round_trip_in_temp_dir() {
        let dir = tempfile::tempdir().unwrap();
        let token = load_or_create(dir.path()).unwrap();
        assert_eq!(token.len(), 64);
        // 再次读取返回同一 token，不重写。
        assert_eq!(load_or_create(dir.path()).unwrap(), token);
        assert_eq!(std::fs::read_to_string(token_file(dir.path())).unwrap().trim(), token);
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mode = std::fs::metadata(token_file(dir.path())).unwrap().permissions().mode();
            assert_eq!(mode & 0o777, 0o600);
        }
    }

    #[test]
    fn constant_time_style_comparison() {
        let token = random_token();
        assert!(matches(Some(&token), &token));
        assert!(!matches(None, &token));
        assert!(!matches(Some(&token[..63]), &token));
        assert!(!matches(Some("another"), &token));
    }

    #[test]
    fn default_data_dir_honors_xdg() {
        std::env::set_var("XDG_DATA_HOME", "/tmp/xdg-data");
        assert_eq!(
            default_data_dir(),
            PathBuf::from("/tmp/xdg-data/studio.tomato.todo/guard")
        );
        std::env::remove_var("XDG_DATA_HOME");
    }
}
