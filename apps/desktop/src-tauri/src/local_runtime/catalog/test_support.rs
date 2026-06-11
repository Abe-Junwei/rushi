//! Serialize tests that mutate process environment variables.

use std::sync::{LazyLock, Mutex};

static ENV_TEST_LOCK: LazyLock<Mutex<()>> = LazyLock::new(|| Mutex::new(()));

pub fn env_test_lock() -> std::sync::MutexGuard<'static, ()> {
    ENV_TEST_LOCK.lock().expect("env test lock poisoned")
}
