import hashlib
import io

import pytest

from rushi_asr import funasr_nano_remote_code as code


def test_code_integrity_before_download_write_and_load(monkeypatch, tmp_path):
    files = {"model.py": b"# synthetic model", "tools/__init__.py": b""}
    monkeypatch.setattr(code, "_FILES", {p: hashlib.sha256(b).hexdigest() for p, b in files.items()})
    monkeypatch.setattr(code.urllib.request, "urlopen", lambda url, **kw: io.BytesIO(files[url.removeprefix(code._BASE + "/")]))
    assert not code.funasr_nano_remote_code_ready(tmp_path)
    code.sync_funasr_nano_remote_code(tmp_path)
    assert code.funasr_nano_remote_code_ready(tmp_path)
    (tmp_path / "model.py").write_bytes(b"# tampered")
    assert not code.funasr_nano_remote_code_ready(tmp_path)
    monkeypatch.setattr(code.urllib.request, "urlopen", lambda *a, **kw: io.BytesIO(b"# tampered download"))
    with pytest.raises(RuntimeError, match="sha256_mismatch"):
        code.sync_funasr_nano_remote_code(tmp_path, force=True)
    assert (tmp_path / "model.py").read_bytes() == b"# tampered"
    (tmp_path / "model.py").write_bytes(files["model.py"])
    (tmp_path / "tools" / "unexpected.py").write_bytes(b"# unexpected executable")
    assert not code.funasr_nano_remote_code_ready(tmp_path)


def test_manifest_pins_commit_and_sha256():
    assert len(code._REVISION) == 40
    assert all(c in "0123456789abcdef" for c in code._REVISION)
    assert {"model.py", "ctc.py", "__init__.py", "tools/__init__.py"} <= code._FILES.keys()
    assert all(len(digest) == 64 for digest in code._FILES.values())


def test_verified_import_does_not_run_model_requirements(monkeypatch, tmp_path):
    import sys
    content = b"verified_synthetic_value = 7\n"
    monkeypatch.setattr(code, "_FILES", {"model.py": hashlib.sha256(content).hexdigest()})
    monkeypatch.setattr(code, "_REVISION", "synthetic_import_test")
    (tmp_path / "model.py").write_bytes(content)
    (tmp_path / "requirements.txt").write_text("must-never-be-installed")
    (tmp_path / "tools").mkdir()
    name = "rushi_funasr_nano_synthetic_import_test"
    try:
        code.load_funasr_nano_remote_code(tmp_path)
        assert sys.modules[name].verified_synthetic_value == 7
        assert str(tmp_path) not in sys.path
        (tmp_path / "model.py").write_bytes(b"raise AssertionError('unverified code ran')")
        with pytest.raises(RuntimeError, match="unverified"):
            code.load_funasr_nano_remote_code(tmp_path)
    finally:
        sys.modules.pop(name, None)
