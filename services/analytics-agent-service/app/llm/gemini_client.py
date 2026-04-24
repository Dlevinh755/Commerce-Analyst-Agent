from __future__ import annotations

import time
from typing import Any, Type, TypeVar
from google import genai
from google.genai import errors as genai_errors
from google.genai import types
from pydantic import BaseModel

from app.config import settings

T = TypeVar("T", bound=BaseModel)


class GeminiClient:
    _MAX_RETRIES = 3

    def __init__(self) -> None:
        self.client = genai.Client(api_key=settings.GOOGLE_API_KEY)

    def _candidate_models(self, model: str) -> list[str]:
        models = [model]
        fallbacks = [settings.GOOGLE_SMALL_MODEL, settings.GOOGLE_LARGE_MODEL]
        for fallback in fallbacks:
            if fallback and fallback not in models:
                models.append(fallback)
        return models

    def _is_retryable_error(self, error: Exception) -> bool:
        if isinstance(error, (genai_errors.ServerError, genai_errors.APIError)):
            status_code = getattr(error, "status_code", None)
            if status_code in {429, 500, 502, 503, 504}:
                return True
            if isinstance(error, genai_errors.ServerError):
                return True

        # Fallback in case SDK wraps/changes exception classes.
        message = str(error).lower()
        retry_signals = (
            "timeout",
            "temporarily unavailable",
            "internal error",
            "connection reset",
            "service unavailable",
        )
        return any(signal in message for signal in retry_signals)

    def _generate_content_with_resilience(
        self,
        *,
        model: str,
        prompt: str,
        config: types.GenerateContentConfig | None = None,
    ):
        last_error: Exception | None = None

        for candidate_model in self._candidate_models(model):
            for attempt in range(1, self._MAX_RETRIES + 1):
                try:
                    return self.client.models.generate_content(
                        model=candidate_model,
                        contents=prompt,
                        config=config,
                    )
                except Exception as exc:
                    last_error = exc
                    if not self._is_retryable_error(exc) or attempt == self._MAX_RETRIES:
                        break

                    # Exponential backoff: 0.8s, 1.6s
                    time.sleep(0.8 * (2 ** (attempt - 1)))

        if last_error is not None:
            raise last_error
        raise RuntimeError("Gemini generate_content failed without an explicit error")

    def _response_text(self, response: Any) -> str:
        candidates = getattr(response, "candidates", None) or []
        for candidate in candidates:
            content = getattr(candidate, "content", None)
            parts = getattr(content, "parts", None) or []
            text_parts: list[str] = []
            for part in parts:
                text = getattr(part, "text", None)
                if text:
                    text_parts.append(text)
            if text_parts:
                return "".join(text_parts).strip()

        text = getattr(response, "text", None)
        return (text or "").strip()

    def _gemini_schema(self, schema: Type[T]) -> dict[str, Any]:
        schema_dict = schema.model_json_schema()

        def _unescape_json_pointer_token(token: str) -> str:
            return token.replace("~1", "/").replace("~0", "~")

        def _resolve_local_ref(ref: str) -> Any:
            if not ref.startswith("#/"):
                return {}
            current: Any = schema_dict
            for raw_token in ref[2:].split("/"):
                token = _unescape_json_pointer_token(raw_token)
                if not isinstance(current, dict) or token not in current:
                    return {}
                current = current[token]
            return current

        def strip_for_gemini(value: Any) -> Any:
            if isinstance(value, dict):
                # Inline local references before removing $defs/defs.
                if "$ref" in value and isinstance(value["$ref"], str):
                    resolved = strip_for_gemini(_resolve_local_ref(value["$ref"]))
                    overlay = {
                        key: strip_for_gemini(item)
                        for key, item in value.items()
                        if key != "$ref"
                    }
                    if isinstance(resolved, dict):
                        return {**resolved, **overlay}
                    return overlay

                # Flatten Optional[T] schema generated as anyOf[T, null].
                if "anyOf" in value and isinstance(value["anyOf"], list):
                    options = [strip_for_gemini(item) for item in value["anyOf"]]
                    non_null_options = [
                        opt
                        for opt in options
                        if not (isinstance(opt, dict) and opt.get("type") == "null")
                    ]
                    if non_null_options:
                        merged = {
                            key: strip_for_gemini(item)
                            for key, item in value.items()
                            if key not in {"anyOf", "additionalProperties", "additional_properties", "$defs", "defs", "$schema"}
                        }
                        first = non_null_options[0]
                        if isinstance(first, dict):
                            return {**first, **merged}
                        return merged

                return {
                    key: strip_for_gemini(item)
                    for key, item in value.items()
                    if key not in {"additionalProperties", "additional_properties", "$defs", "defs", "$schema"}
                }
            if isinstance(value, list):
                return [strip_for_gemini(item) for item in value]
            return value

        return strip_for_gemini(schema_dict)

    def generate_text(self, *, model: str, prompt: str) -> str:
        response = self._generate_content_with_resilience(
            model=model,
            prompt=prompt,
        )
        return self._response_text(response)

    def generate_structured(self, *, model: str, prompt: str, schema: Type[T]) -> T:
        response = self._generate_content_with_resilience(
            model=model,
            prompt=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_json_schema=self._gemini_schema(schema),
            ),
        )
        text = self._response_text(response)
        return schema.model_validate_json(text)
