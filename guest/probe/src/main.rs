//! formicarium の合格判定用 probe（FR5.1）。
//!
//! 各項目は `PASS <名前>` または `FAIL <名前>: <理由>` を 1 行で stdout に出す。
//! すべての項目が PASS のときだけ終了コード 0 を返し、1 つでも FAIL があれば 1 を返す。
//! 引数に項目名を渡すと、その項目だけを実行する（未知の名前は終了コード 2）。
//!
//! 合格条件は、コード生成計画の Step 4（R-01）に書いたとおり。

use std::fs;
use std::io::{Read, Write};
use std::os::unix::fs::MetadataExt;
use std::os::unix::io::AsRawFd;
use std::os::unix::net::UnixStream;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Condvar, Mutex};
use std::time::{Duration, Instant};

type Check = fn() -> Result<(), String>;
mod futex_deadline;
mod page_fault_race;
mod madvise_dontneed;
mod bsf_zero;

const CHECKS: &[(&str, Check)] = &[
    ("tokio-timer", tokio_timer),
    ("unix-stream-pair", unix_stream_pair),
    ("rayon", rayon_sum),
    ("mutex-condvar", mutex_condvar),
    ("fs-basic", fs_basic),
    ("fs-hardlink", fs_hardlink),
    ("fs-symlink", fs_symlink),
    ("fs-flock", fs_flock),
];

fn main() {
    let mut selected: Vec<String> = std::env::args().skip(1).collect();
    let diagnostic = selected.iter().any(|arg| arg == "--diagnostic");
    selected.retain(|arg| arg != "--diagnostic");
    if selected == ["bsf-zero"] {
        match bsf_zero::check() {
            Ok(()) => println!("PASS bsf-zero"),
            Err(error) => {
                println!("FAIL bsf-zero: {error}");
                std::process::exit(1);
            }
        }
        return;
    }
    if selected == ["futex-deadline"] {
        match futex_deadline::check() {
            Ok(()) => println!("PASS futex-deadline"),
            Err(error) => {
                println!("FAIL futex-deadline: {error}");
                std::process::exit(1);
            }
        }
        return;
    }
    if selected == ["madvise-dontneed"] {
        match madvise_dontneed::check() {
            Ok(()) => println!("PASS madvise-dontneed"),
            Err(error) => {
                println!("FAIL madvise-dontneed: {error}");
                std::process::exit(1);
            }
        }
        return;
    }
    if selected == ["page-fault-race"] {
        match page_fault_race::check() {
            Ok(()) => println!("PASS page-fault-race"),
            Err(error) => {
                println!("FAIL page-fault-race: {error}");
                std::process::exit(1);
            }
        }
        return;
    }
    for name in &selected {
        if !CHECKS.iter().any(|(n, _)| n == name) {
            eprintln!("unknown check: {name}");
            std::process::exit(2);
        }
    }
    let mut all_passed = true;
    for (name, check) in CHECKS {
        if !selected.is_empty() && !selected.iter().any(|s| s == name) {
            continue;
        }
        // panic も FAIL として数える（1 項目の失敗で残りを止めない）。
        if diagnostic { eprintln!("START {name}"); }
        let outcome = std::panic::catch_unwind(check)
            .unwrap_or_else(|panic| Err(format!("panicked: {}", panic_message(&panic))));
        match outcome {
            Ok(()) => println!("PASS {name}"),
            Err(reason) => {
                all_passed = false;
                println!("FAIL {name}: {reason}");
            }
        }
        // 1 項目ごとに出力を確定させる（途中で止まっても、どこまで進んだか分かるように）。
        let _ = std::io::stdout().flush();
        if diagnostic { eprintln!("END {name}"); }
    }
    std::process::exit(if all_passed { 0 } else { 1 });
}

fn panic_message(panic: &Box<dyn std::any::Any + Send>) -> String {
    if let Some(s) = panic.downcast_ref::<&str>() {
        (*s).to_string()
    } else if let Some(s) = panic.downcast_ref::<String>() {
        s.clone()
    } else {
        "unknown panic".to_string()
    }
}

fn ensure(condition: bool, reason: impl FnOnce() -> String) -> Result<(), String> {
    if condition {
        Ok(())
    } else {
        Err(reason())
    }
}

/// worker 4 スレッドの multi-thread runtime で、sleep(50ms) が 50ms 以上 2000ms 以内に発火し、
/// interval(10ms) が 5 回発火する。
fn tokio_timer() -> Result<(), String> {
    let runtime = tokio::runtime::Builder::new_multi_thread()
        .worker_threads(4)
        .enable_time()
        .build()
        .map_err(|e| format!("runtime build failed: {e}"))?;
    runtime.block_on(async {
        let task = tokio::spawn(async {
            let start = Instant::now();
            tokio::time::sleep(Duration::from_millis(50)).await;
            start.elapsed()
        });
        let elapsed = task.await.map_err(|e| format!("sleep task failed: {e}"))?;
        ensure(
            elapsed >= Duration::from_millis(50) && elapsed <= Duration::from_millis(2000),
            || format!("sleep(50ms) fired after {elapsed:?}"),
        )?;
        let ticks = tokio::spawn(async {
            let mut interval = tokio::time::interval(Duration::from_millis(10));
            for _ in 0..5 {
                interval.tick().await;
            }
            5u32
        });
        let fired = tokio::time::timeout(Duration::from_secs(10), ticks)
            .await
            .map_err(|_| "interval(10ms) did not fire 5 times within 10s".to_string())?
            .map_err(|e| format!("interval task failed: {e}"))?;
        ensure(fired == 5, || format!("interval fired {fired} times"))
    })
}

/// UnixStream::pair の片側から 1 MiB を書き、もう片側で同一内容を読み切る。書き手を閉じると EOF。
fn unix_stream_pair() -> Result<(), String> {
    const SIZE: usize = 1 << 20;
    let (mut writer, mut reader) =
        UnixStream::pair().map_err(|e| format!("UnixStream::pair failed: {e}"))?;
    let payload: Vec<u8> = (0..SIZE).map(|i| (i * 31 % 251) as u8).collect();
    let expected = payload.clone();
    let handle = std::thread::spawn(move || -> Result<(), String> {
        writer
            .write_all(&payload)
            .map_err(|e| format!("write failed: {e}"))?;
        drop(writer);
        Ok(())
    });
    let mut received = Vec::with_capacity(SIZE);
    reader
        .read_to_end(&mut received)
        .map_err(|e| format!("read failed: {e}"))?;
    handle
        .join()
        .map_err(|_| "writer thread panicked".to_string())??;
    ensure(received.len() == SIZE, || {
        format!("received {} bytes, expected {SIZE}", received.len())
    })?;
    ensure(received == expected, || "received bytes differ".to_string())?;
    let mut extra = [0u8; 16];
    let n = reader
        .read(&mut extra)
        .map_err(|e| format!("read after EOF failed: {e}"))?;
    ensure(n == 0, || format!("expected EOF, read {n} bytes"))
}

/// 4 スレッドの pool で (0..1_000_000).into_par_iter().sum() が 499999500000 になる。
fn rayon_sum() -> Result<(), String> {
    use rayon::prelude::*;
    let pool = rayon::ThreadPoolBuilder::new()
        .num_threads(4)
        .build()
        .map_err(|e| format!("pool build failed: {e}"))?;
    let sum: u64 = pool.install(|| (0..1_000_000u64).into_par_iter().sum());
    ensure(sum == 499_999_500_000, || format!("sum was {sum}"))
}

/// 4 スレッドが Mutex のカウンタを 10,000 回ずつ増やして 40,000 になる。
/// Condvar のピンポン 1,000 往復が 10 秒以内に終わる。
fn mutex_condvar() -> Result<(), String> {
    let counter = Arc::new(Mutex::new(0u64));
    let workers: Vec<_> = (0..4)
        .map(|_| {
            let counter = Arc::clone(&counter);
            std::thread::spawn(move || {
                for _ in 0..10_000 {
                    *counter.lock().unwrap() += 1;
                }
            })
        })
        .collect();
    for worker in workers {
        worker
            .join()
            .map_err(|_| "counter thread panicked".to_string())?;
    }
    let total = *counter.lock().unwrap();
    ensure(total == 40_000, || format!("counter was {total}"))?;

    const ROUNDS: u32 = 1_000;
    // turn が偶数なら ping の番、奇数なら pong の番。
    let state = Arc::new((Mutex::new(0u32), Condvar::new()));
    let start = Instant::now();
    let pong_state = Arc::clone(&state);
    let pong = std::thread::spawn(move || {
        let (lock, cvar) = &*pong_state;
        let mut turn = lock.lock().unwrap();
        while *turn < 2 * ROUNDS {
            while *turn % 2 == 0 {
                turn = cvar.wait(turn).unwrap();
            }
            *turn += 1;
            cvar.notify_one();
        }
    });
    {
        let (lock, cvar) = &*state;
        let mut turn = lock.lock().unwrap();
        while *turn < 2 * ROUNDS {
            while *turn % 2 == 1 {
                let (next, timeout) = cvar.wait_timeout(turn, Duration::from_secs(10)).unwrap();
                turn = next;
                if timeout.timed_out() {
                    return Err(format!("condvar ping-pong stalled at turn {}", *turn));
                }
            }
            if *turn >= 2 * ROUNDS {
                break;
            }
            *turn += 1;
            cvar.notify_one();
        }
    }
    pong.join()
        .map_err(|_| "pong thread panicked".to_string())?;
    let elapsed = start.elapsed();
    ensure(elapsed <= Duration::from_secs(10), || {
        format!("{ROUNDS} round trips took {elapsed:?}")
    })
}

/// 項目ごとの作業ディレクトリ。前回の残りがあれば消してから作る。
fn scratch_dir(name: &str) -> Result<PathBuf, String> {
    let dir = std::env::temp_dir().join(format!("formicarium-probe-{}-{name}", std::process::id()));
    if dir.exists() {
        fs::remove_dir_all(&dir).map_err(|e| format!("cleanup of {dir:?} failed: {e}"))?;
    }
    fs::create_dir_all(&dir).map_err(|e| format!("mkdir {dir:?} failed: {e}"))?;
    Ok(dir)
}

fn read_string(path: &Path) -> Result<String, String> {
    fs::read_to_string(path).map_err(|e| format!("read {path:?} failed: {e}"))
}

/// 作成・書き込み・読み戻し・rename・read_dir。
fn fs_basic() -> Result<(), String> {
    let dir = scratch_dir("basic")?;
    let first = dir.join("first.txt");
    fs::write(&first, "formicarium").map_err(|e| format!("write failed: {e}"))?;
    ensure(read_string(&first)? == "formicarium", || {
        "read back differs".to_string()
    })?;
    let renamed = dir.join("renamed.txt");
    fs::rename(&first, &renamed).map_err(|e| format!("rename failed: {e}"))?;
    ensure(!first.exists(), || "old name still exists after rename".to_string())?;
    ensure(read_string(&renamed)? == "formicarium", || {
        "renamed file content differs".to_string()
    })?;
    fs::create_dir(dir.join("sub")).map_err(|e| format!("mkdir sub failed: {e}"))?;
    let mut names: Vec<String> = fs::read_dir(&dir)
        .map_err(|e| format!("read_dir failed: {e}"))?
        .map(|entry| entry.map(|e| e.file_name().to_string_lossy().into_owned()))
        .collect::<Result<_, _>>()
        .map_err(|e| format!("read_dir entry failed: {e}"))?;
    names.sort();
    ensure(names == ["renamed.txt", "sub"], || format!("read_dir returned {names:?}"))?;
    fs::remove_dir_all(&dir).map_err(|e| format!("cleanup failed: {e}"))
}

/// hard link 後の nlink が 2 で、片方への書き込みがもう片方から見える。
fn fs_hardlink() -> Result<(), String> {
    let dir = scratch_dir("hardlink")?;
    let original = dir.join("original.txt");
    let link = dir.join("link.txt");
    fs::write(&original, "before").map_err(|e| format!("write failed: {e}"))?;
    fs::hard_link(&original, &link).map_err(|e| format!("hard_link failed: {e}"))?;
    let nlink = fs::metadata(&original)
        .map_err(|e| format!("stat failed: {e}"))?
        .nlink();
    ensure(nlink == 2, || format!("nlink was {nlink}"))?;
    fs::write(&link, "after").map_err(|e| format!("write through link failed: {e}"))?;
    ensure(read_string(&original)? == "after", || {
        "write through the link is not visible from the original".to_string()
    })?;
    fs::remove_dir_all(&dir).map_err(|e| format!("cleanup failed: {e}"))
}

/// readlink が作成時のパスを返し、symlink 経由で読める。
fn fs_symlink() -> Result<(), String> {
    let dir = scratch_dir("symlink")?;
    let target = dir.join("target.txt");
    let link = dir.join("link");
    fs::write(&target, "through symlink").map_err(|e| format!("write failed: {e}"))?;
    std::os::unix::fs::symlink(&target, &link).map_err(|e| format!("symlink failed: {e}"))?;
    let read_back = fs::read_link(&link).map_err(|e| format!("read_link failed: {e}"))?;
    ensure(read_back == target, || format!("read_link returned {read_back:?}"))?;
    ensure(read_string(&link)? == "through symlink", || {
        "content through the symlink differs".to_string()
    })?;
    fs::remove_dir_all(&dir).map_err(|e| format!("cleanup failed: {e}"))
}

fn flock(file: &fs::File, operation: libc::c_int) -> std::io::Result<()> {
    // SAFETY: file は開いている fd を持つ。flock は fd とフラグだけを受け取る。
    let rc = unsafe { libc::flock(file.as_raw_fd(), operation) };
    if rc == 0 {
        Ok(())
    } else {
        Err(std::io::Error::last_os_error())
    }
}

/// 1 つ目の fd で LOCK_EX を取ると、2 つ目の fd の LOCK_EX|LOCK_NB が EWOULDBLOCK を返す。
/// 解放後は取得できる。
fn fs_flock() -> Result<(), String> {
    let dir = scratch_dir("flock")?;
    let path = dir.join("lock");
    fs::write(&path, "").map_err(|e| format!("create failed: {e}"))?;
    let first = fs::File::open(&path).map_err(|e| format!("open #1 failed: {e}"))?;
    let second = fs::File::open(&path).map_err(|e| format!("open #2 failed: {e}"))?;
    flock(&first, libc::LOCK_EX).map_err(|e| format!("LOCK_EX on #1 failed: {e}"))?;
    match flock(&second, libc::LOCK_EX | libc::LOCK_NB) {
        Ok(()) => return Err("LOCK_EX|LOCK_NB on #2 succeeded while #1 held the lock".into()),
        Err(e) if e.raw_os_error() == Some(libc::EWOULDBLOCK) => {}
        Err(e) => return Err(format!("LOCK_EX|LOCK_NB on #2 failed with {e}, expected EWOULDBLOCK")),
    }
    flock(&first, libc::LOCK_UN).map_err(|e| format!("LOCK_UN on #1 failed: {e}"))?;
    flock(&second, libc::LOCK_EX | libc::LOCK_NB)
        .map_err(|e| format!("LOCK_EX|LOCK_NB on #2 after unlock failed: {e}"))?;
    drop(first);
    drop(second);
    fs::remove_dir_all(&dir).map_err(|e| format!("cleanup failed: {e}"))
}
