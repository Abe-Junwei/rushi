use super::types::RuntimeComponent;

pub fn artifact_sources(component: &RuntimeComponent) -> Vec<String> {
    let mut sources = Vec::with_capacity(1 + component.mirror_urls.len());
    for source in std::iter::once(&component.url).chain(component.mirror_urls.iter()) {
        let trimmed = source.trim();
        if trimmed.is_empty() {
            continue;
        }
        if !sources.iter().any(|existing| existing == trimmed) {
            sources.push(trimmed.to_string());
        }
    }
    sources
}
