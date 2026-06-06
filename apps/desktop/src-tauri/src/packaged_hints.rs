//! User-facing hints: dev build vs release bundle (no npm/terminal in shipped app).

pub fn dev_or_packaged_str(dev: &'static str, packaged: &'static str) -> &'static str {
    if cfg!(debug_assertions) {
        dev
    } else {
        packaged
    }
}
