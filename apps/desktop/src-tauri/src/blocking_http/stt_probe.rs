use std::sync::OnceLock;
use std::time::Duration;

use reqwest::blocking::Client;

static PROBE_BLOCKING_CLIENT: OnceLock<Client> = OnceLock::new();
static PROBE_BLOCKING_DIRECT: OnceLock<Client> = OnceLock::new();

pub fn build_stt_probe_blocking_client(use_system_proxy: bool) -> Client {
    let mut builder = Client::builder()
        .connect_timeout(Duration::from_secs(6))
        .user_agent(format!("rushi-desktop/{}", env!("CARGO_PKG_VERSION")));
    if !use_system_proxy {
        builder = builder.no_proxy();
    }
    builder
        .build()
        .expect("reqwest blocking stt probe client build")
}

pub fn stt_probe_blocking_client(use_system_proxy: bool) -> &'static Client {
    if use_system_proxy {
        PROBE_BLOCKING_CLIENT.get_or_init(|| build_stt_probe_blocking_client(true))
    } else {
        PROBE_BLOCKING_DIRECT.get_or_init(|| build_stt_probe_blocking_client(false))
    }
}
