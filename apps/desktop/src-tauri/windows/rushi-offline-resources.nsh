; Sibling offline unpack: copy Plan B models from $EXEDIR\resources into $INSTDIR.
; Used via bundle.windows.nsis.installerHooks (Tauri 2).
;
; Routes:
;   - Offline zip (sibling resources present) → CopyFiles + deep check
;   - OTA / silent upgrade with existing installed models → skip
;   - Interactive bare setup.exe without sibling and without prior INSTDIR models → Abort
;   - Silent first install without sibling models → Abort with non-zero installer status

!macro NSIS_HOOK_POSTINSTALL
  DetailPrint "正在验证离线语音模型组件源..."

  IfFileExists "$EXEDIR\resources\bundled-asr-models\manifest.json" l_do_copy

  ; No sibling layout (OTA temp dir, or bare exe).
  IfFileExists "$INSTDIR\resources\bundled-asr-models\manifest.json" 0 l_no_instdir_models
  IfFileExists "$INSTDIR\resources\bundled-asr-models\modelscope\*.*" l_skip_models
  l_no_instdir_models:
    ; Any first install without offline resources must fail closed, including /S.
    ; OTA remains valid when an earlier Route 3 install already populated INSTDIR models.
    IfSilent l_abort_missing
    MessageBox MB_OK|MB_ICONSTOP "【安装中止】未找到离线语音模型组件。$\r$\n$\r$\n原因：未完整解压「离线安装包.zip」，或单独运行了安装程序。$\r$\n$\r$\n解决办法：请将 zip【全部解压】到同一文件夹后，再运行同级安装包。"
    l_abort_missing:
    SetErrorLevel 2
    Abort
  l_skip_models:
    DetailPrint "跳过离线模型释放（OTA/静默升级，或安装目录已有模型）。"
    Goto l_done

  l_do_copy:
  DetailPrint "正在释放离线语音模型（约 1.1 GB）..."
  SetOutPath "$INSTDIR"
  CreateDirectory "$INSTDIR\resources"
  ; Directory-level copy (recursive tree). Dest parent = resources → bundled-asr-models\.
  ClearErrors
  CopyFiles /SILENT "$EXEDIR\resources\bundled-asr-models" "$INSTDIR\resources"
  IfErrors l_copy_failed

  IfFileExists "$INSTDIR\resources\bundled-asr-models\manifest.json" 0 l_copy_failed
  ; Directory non-empty check (NSIS: path\*.* means "is a directory with entries").
  IfFileExists "$INSTDIR\resources\bundled-asr-models\modelscope\*.*" l_copy_success

  l_copy_failed:
    DetailPrint "错误：离线模型资源复制失败或不完整。"
    MessageBox MB_OK|MB_ICONSTOP "错误：语音模型文件释放失败。$\r$\n$\r$\n可能原因：$\r$\n1. 安装盘剩余空间不足（建议 ≥3GB）。$\r$\n2. 杀毒软件或权限拦截写入。$\r$\n$\r$\n请清理空间后，右键安装包「以管理员身份运行」重试。"
    Abort

  l_copy_success:
  DetailPrint "离线语音模型组件释放成功。"

  l_done:
!macroend
