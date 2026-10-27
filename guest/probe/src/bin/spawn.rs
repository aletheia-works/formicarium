//! ランナーのテスト用ゲスト。最初の引数の command を PATH から探して残りの引数で実行し、
//! その終了コードで終わる（導入済みのゲストを別のゲストから起動できることの確認用）。
use std::os::unix::process::ExitStatusExt;
use std::process::{exit, Command};

fn main() {
    let mut args = std::env::args().skip(1);
    let Some(program) = args.next() else {
        eprintln!("usage: spawn <command> [args...]");
        exit(2);
    };
    match Command::new(&program).args(args).status() {
        Ok(status) => exit(
            status
                .code()
                .unwrap_or_else(|| 128 + status.signal().unwrap_or(0)),
        ),
        Err(error) => {
            eprintln!("spawn: {program}: {error}");
            exit(127);
        }
    }
}
