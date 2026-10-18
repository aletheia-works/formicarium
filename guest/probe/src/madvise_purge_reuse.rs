//! Explicit diagnostic: purge across a 2MiB page-table boundary after a
//! second thread has cached every byte, then reuse the same mapping.
use std::sync::mpsc;
use std::time::Duration;

const PAGE: usize = 4096;
const BOUNDARY: usize = 2 * 1024 * 1024;
const LENGTH: usize = 0x80000;

struct Mapping { base: *mut libc::c_void, len: usize }
impl Drop for Mapping {
    fn drop(&mut self) { unsafe { libc::munmap(self.base, self.len); } }
}

// Accesses are volatile so the compiler cannot replace the actual cross-thread
// reads with the earlier fill. Channels serialize every read/write phase.
fn expect(address: usize, len: usize, byte: u8, phase: &str) -> Result<(), String> {
    for offset in 0..len {
        let actual = unsafe { ((address + offset) as *const u8).read_volatile() };
        if actual != byte {
            return Err(format!("{phase}: offset {offset:#x} reads {actual:#x}, expected {byte:#x}"));
        }
    }
    Ok(())
}
fn fill(address: usize, len: usize, byte: u8) {
    for offset in 0..len {
        unsafe { ((address + offset) as *mut u8).write_volatile(byte); }
    }
}
fn sentinels(start: usize) -> Result<(), String> {
    expect(start - PAGE, PAGE, 0x3c, "left sentinel")?;
    expect(start + LENGTH, PAGE, 0xc3, "right sentinel")
}

pub fn check() -> Result<(), String> {
    // Overallocate instead of MAP_FIXED: the diagnostic never replaces an
    // unrelated mapping. The next aligned boundary leaves room on both sides.
    let len = 2 * BOUNDARY + LENGTH + 2 * PAGE;
    let base = unsafe {
        libc::mmap(std::ptr::null_mut(), len, libc::PROT_READ | libc::PROT_WRITE,
            libc::MAP_PRIVATE | libc::MAP_ANONYMOUS, -1, 0)
    };
    if base == libc::MAP_FAILED {
        return Err(format!("mmap failed: {}", std::io::Error::last_os_error()));
    }
    let _mapping = Mapping { base, len };
    let boundary = ((base as usize + BOUNDARY - 1) & !(BOUNDARY - 1)) + BOUNDARY;
    let start = boundary - LENGTH / 2;
    if start - PAGE < base as usize || start + LENGTH + PAGE > base as usize + len {
        return Err("aligned diagnostic range escapes allocated mapping".into());
    }
    fill(start, LENGTH, 0xa5);
    fill(start - PAGE, PAGE, 0x3c);
    fill(start + LENGTH, PAGE, 0xc3);

    let (commands, receive) = mpsc::channel::<()>();
    let (reports, results) = mpsc::channel::<Result<(), String>>();
    let worker = std::thread::spawn(move || {
        let primed = expect(start, LENGTH, 0xa5, "second thread pre-read")
            .and_then(|_| sentinels(start));
        if reports.send(primed).is_err() || receive.recv().is_err() { return; }
        let zero = expect(start, LENGTH, 0, "second thread after purge")
            .and_then(|_| sentinels(start));
        if reports.send(zero).is_err() || receive.recv().is_err() { return; }
        let reused = expect(start, LENGTH, 0x5a, "second thread after main rewrite")
            .and_then(|_| sentinels(start));
        // Return the rewrite phase result first, then a synchronized result of
        // writing from the second thread back to the main thread.
        if reports.send(reused).is_err() || receive.recv().is_err() { return; }
        fill(start, LENGTH, 0x96);
        let _ = reports.send(expect(start, LENGTH, 0x96, "second thread rewrite")
            .and_then(|_| sentinels(start)));
    });
    let result = (|| {
        let receive_result = || results.recv_timeout(Duration::from_secs(30))
            .map_err(|error| format!("diagnostic thread synchronization failed: {error}"))?;
        receive_result()?;
        let rc = unsafe { libc::madvise(start as *mut libc::c_void, LENGTH, libc::MADV_DONTNEED) };
        if rc != 0 { return Err(format!("madvise failed: {}", std::io::Error::last_os_error())); }
        expect(start, LENGTH, 0, "main thread after purge")?;
        sentinels(start)?;
        commands.send(()).map_err(|error| error.to_string())?;
        receive_result()?;
        fill(start, LENGTH, 0x5a);
        expect(start, LENGTH, 0x5a, "main thread rewrite")?;
        commands.send(()).map_err(|error| error.to_string())?;
        receive_result()?;
        commands.send(()).map_err(|error| error.to_string())?;
        receive_result()?;
        expect(start, LENGTH, 0x96, "main thread after second thread rewrite")?;
        sentinels(start)
    })();
    // On any failure, dropping the command channel wakes the waiting thread.
    // The mapping stays alive until that thread has finished all accesses.
    drop(commands);
    worker.join().map_err(|_| "diagnostic thread panicked".to_string())?;
    result
}
