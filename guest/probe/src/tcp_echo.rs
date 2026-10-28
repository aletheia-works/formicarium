//! A TCP client round trip through the host's network.
//!
//! Connects to the given address, sends a message, closes its sending side and
//! expects the same bytes back, as from an echo server. A failure names the
//! step and its errno, so a test can tell a refused network (EAFNOSUPPORT) from
//! a destination that is not allowed (ENETUNREACH).
use std::io::{Read, Write};
use std::net::{Shutdown, SocketAddr, TcpStream};

const MESSAGE: &[u8] = b"formicarium tcp-echo\n";

fn os_error(step: &str, error: std::io::Error) -> String {
    format!("{step}: {error} (errno {})", error.raw_os_error().unwrap_or(0))
}

pub fn check(target: &str) -> Result<(), String> {
    let address: SocketAddr = target
        .parse()
        .map_err(|_| format!("{target} is not an address:port"))?;
    let mut stream = TcpStream::connect(address).map_err(|e| os_error("connect", e))?;
    let peer = stream.peer_addr().map_err(|e| os_error("getpeername", e))?;
    if peer != address {
        return Err(format!("getpeername gives {peer}, want {address}"));
    }
    let local = stream.local_addr().map_err(|e| os_error("getsockname", e))?;
    if local.is_ipv4() != address.is_ipv4() {
        return Err(format!("getsockname gives {local} for {address}"));
    }
    stream.set_nodelay(true).map_err(|e| os_error("TCP_NODELAY", e))?;
    stream.write_all(MESSAGE).map_err(|e| os_error("send", e))?;
    stream.shutdown(Shutdown::Write).map_err(|e| os_error("shutdown", e))?;
    let mut echoed = Vec::new();
    stream.read_to_end(&mut echoed).map_err(|e| os_error("recv", e))?;
    if echoed != MESSAGE {
        return Err(format!("echo returned {:?}", String::from_utf8_lossy(&echoed)));
    }
    Ok(())
}
