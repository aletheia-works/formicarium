//! 対話的な実行のテスト用ゲスト。stdin・stdout が端末かどうかと端末のサイズを出し、
//! stdin を EOF まで読んで、受け取ったバイトを 16 進で 1 行に出す。
use std::io::{Read, Write};

fn main() {
    let tty = |fd| unsafe { libc::isatty(fd) };
    let mut size: libc::winsize = unsafe { std::mem::zeroed() };
    let sized = unsafe { libc::ioctl(1, libc::TIOCGWINSZ, &mut size) } == 0;
    let mut out = std::io::stdout();
    writeln!(out, "tty in={} out={}", tty(0), tty(1)).unwrap();
    if sized {
        writeln!(out, "size {}x{}", size.ws_col, size.ws_row).unwrap();
    } else {
        writeln!(out, "size none").unwrap();
    }
    out.flush().unwrap();
    let mut input = Vec::new();
    std::io::stdin().read_to_end(&mut input).unwrap();
    let hex: Vec<String> = input.iter().map(|b| format!("{b:02x}")).collect();
    writeln!(out, "input {}", hex.join(" ")).unwrap();
}
