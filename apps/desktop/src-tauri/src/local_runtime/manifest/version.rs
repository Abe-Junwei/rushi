#[derive(Clone, Debug, PartialEq, Eq)]
struct ParsedVersion {
    core: Vec<u64>,
    prerelease: Option<Vec<String>>,
}

fn parse_version_parts(version: &str) -> Option<ParsedVersion> {
    let trimmed = version.trim();
    let without_build = trimmed.split('+').next()?.trim();
    let mut parts = without_build.splitn(2, '-');
    let core = parts.next()?.trim();
    if core.is_empty() {
        return None;
    }
    let core = core
        .split('.')
        .map(|part| part.trim().parse::<u64>().ok())
        .collect::<Option<Vec<_>>>()?;
    let prerelease = parts.next().map(|tail| {
        tail.split('.')
            .map(|part| part.trim().to_string())
            .filter(|part| !part.is_empty())
            .collect::<Vec<_>>()
    });
    Some(ParsedVersion { core, prerelease })
}

fn compare_prerelease_part(current: &str, min_required: &str) -> std::cmp::Ordering {
    let current_num = current.parse::<u64>();
    let min_num = min_required.parse::<u64>();
    match (current_num, min_num) {
        (Ok(a), Ok(b)) => a.cmp(&b),
        (Ok(_), Err(_)) => std::cmp::Ordering::Less,
        (Err(_), Ok(_)) => std::cmp::Ordering::Greater,
        (Err(_), Err(_)) => current.cmp(min_required),
    }
}

pub fn is_shell_version_compatible(current: &str, min_required: &str) -> bool {
    let Some(current_parts) = parse_version_parts(current) else {
        return false;
    };
    let Some(min_parts) = parse_version_parts(min_required) else {
        return false;
    };
    let max_len = current_parts.core.len().max(min_parts.core.len());
    for idx in 0..max_len {
        let current_part = *current_parts.core.get(idx).unwrap_or(&0);
        let min_part = *min_parts.core.get(idx).unwrap_or(&0);
        if current_part > min_part {
            return true;
        }
        if current_part < min_part {
            return false;
        }
    }

    match (&current_parts.prerelease, &min_parts.prerelease) {
        (None, None) => true,
        (None, Some(_)) => true,
        (Some(_), None) => false,
        (Some(current_pre), Some(min_pre)) => {
            let max_len = current_pre.len().max(min_pre.len());
            for idx in 0..max_len {
                match (current_pre.get(idx), min_pre.get(idx)) {
                    (Some(current_part), Some(min_part)) => {
                        let ordering = compare_prerelease_part(current_part, min_part);
                        if ordering.is_gt() {
                            return true;
                        }
                        if ordering.is_lt() {
                            return false;
                        }
                    }
                    (Some(_), None) => return true,
                    (None, Some(_)) => return false,
                    (None, None) => return true,
                }
            }
            true
        }
    }
}
