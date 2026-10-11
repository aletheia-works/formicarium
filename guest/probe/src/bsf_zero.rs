//! Native compatibility: BSF zero keeps an initialized destination on the
//! supported Linux x86_64 host. Its destination is architecturally undefined;
//! ZF=1 is architectural, and mimalloc relies on the observed preservation.
use std::arch::asm;

fn verify(label: &str, result: u64, zf: u8, expected: u64, expected_zf: u8) -> Result<(), String> {
    eprintln!("bsf {label} destination={result} zf={zf} expected={expected}/{expected_zf}");
    if result != expected || zf != expected_zf {
        return Err(format!("{label}: destination={result} zf={zf}, want {expected}/{expected_zf}"));
    }
    Ok(())
}

pub fn check() -> Result<(), String> {
    let mut result = 64u64;
    let zf: u8;
    // SAFETY: register-only instructions, no memory/stack accesses. Flags are
    // deliberately clobbered and captured immediately by SETZ.
    unsafe {
        asm!("bsf {dst:x}, {src:x}", "setz {zf}",
             dst = inout(reg) result, src = in(reg) 0x8000u64,
             zf = out(reg_byte) zf, options(nomem, nostack));
    }
    verify("16-nonzero", result, zf, 15, 0)?;
    result = 64;
    let zf: u8;
    unsafe {
        asm!("bsf {dst:e}, {src:e}", "setz {zf}",
             dst = inout(reg) result, src = in(reg) 0x8000u64,
             zf = out(reg_byte) zf, options(nomem, nostack));
    }
    verify("32-nonzero", result, zf, 15, 0)?;
    result = 64;
    let zf: u8;
    unsafe {
        asm!("bsf {dst}, {src}", "setz {zf}",
             dst = inout(reg) result, src = in(reg) (1u64 << 63),
             zf = out(reg_byte) zf, options(nomem, nostack));
    }
    verify("64-nonzero", result, zf, 63, 0)?;

    result = 64;
    let zero_result: u64;
    let zero_zf: u8;
    let next_zf: u8;
    unsafe {
        asm!("bsf {dst}, {zero}", "setz {zf0}", "mov {snapshot}, {dst}",
             "bsf {dst}, {next}", "setz {zf1}",
             dst = inout(reg) result, zero = in(reg) 0u64,
             next = in(reg) 0x8000u64, snapshot = out(reg) zero_result,
             zf0 = out(reg_byte) zero_zf, zf1 = out(reg_byte) next_zf,
             options(nomem, nostack));
    }
    // Print both observations even if the zero compatibility assertion fails.
    let zero = verify("64-zero", zero_result, zero_zf, 64, 1);
    let next = verify("64-zero-to-nonzero", result, next_zf, 15, 0);
    zero?;
    next
}
