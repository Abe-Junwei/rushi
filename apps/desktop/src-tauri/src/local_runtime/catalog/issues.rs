pub fn manifest_blocking_issue(error: &str) -> Option<String> {
    match error {
        "local_runtime_manifest_missing" => {
            Some("未配置本机语音识别组件 manifest，无法应用内下载安装侧车。".into())
        }
        "local_runtime_manifest_source_rejected" => Some(
            "当前 manifest 下载源不符合发行策略。Release 模式仅允许 HTTPS；`file://` / 明文 HTTP 仅限开发或内测显式开启。"
                .into(),
        ),
        "local_runtime_manifest_fixture_key_not_allowed" => Some(
            "当前 manifest 使用了仅限开发/fixture 的签名 key，Release 策略下不可接受。".into(),
        ),
        "local_runtime_manifest_key_unknown" => {
            Some("当前 manifest 使用了未受信任的签名 key。".into())
        }
        "local_runtime_manifest_signature_algorithm_unsupported" => {
            Some("当前 manifest 使用了桌面壳尚未支持的签名算法。".into())
        }
        "local_runtime_manifest_signature_mismatch" => {
            Some("当前 manifest 签名校验失败，已拒绝下载安装。".into())
        }
        _ if error.strip_prefix("manifest_fetch_failed:").is_some()
            || error.strip_prefix("manifest_http_").is_some()
            || error.strip_prefix("manifest_client_build_failed:").is_some() =>
        {
            Some("无法下载本机语音识别组件 manifest，请检查下载源或网络后重试。".into())
        }
        _ if error.strip_prefix("manifest_read_failed:").is_some() => {
            Some("无法读取本机语音识别组件 manifest，请检查下载源是否可访问。".into())
        }
        _ if error.strip_prefix("manifest_parse_failed:").is_some() => {
            Some("本机语音识别组件 manifest 结构无效，无法继续安装。".into())
        }
        _ if error
            .strip_prefix("local_runtime_manifest_signature_decode_failed:")
            .is_some()
            || error
                .strip_prefix("local_runtime_manifest_signature_invalid:")
                .is_some()
            || error.strip_prefix("local_runtime_manifest_key_").is_some() =>
        {
            Some("当前 manifest 的签名元数据无效，已拒绝下载安装。".into())
        }
        _ => None,
    }
}
