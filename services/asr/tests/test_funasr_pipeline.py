from __future__ import annotations

from rushi_asr.funasr_pipeline import effective_funasr_punc_model_id, recognizer_needs_punc_pipeline


def test_recognizer_needs_punc_pipeline() -> None:
    para = "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch"
    assert recognizer_needs_punc_pipeline(para) is True
    assert recognizer_needs_punc_pipeline("iic/SenseVoiceSmall") is False


def test_effective_funasr_punc_model_id() -> None:
    para = "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch"
    assert effective_funasr_punc_model_id(para) == (
        "iic/punc_ct-transformer_zh-cn-common-vocab272727-pytorch"
    )
    assert effective_funasr_punc_model_id("iic/SenseVoiceSmall") is None
