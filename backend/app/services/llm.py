"""One entry point for every model call, routed by role.

Claude models go through the official Anthropic SDK (adaptive thinking is on by default
for current models; effort is set explicitly; server-side refusal fallbacks are enabled for
the models that support them). Every other provider goes through LiteLLM, so a role can be
pointed at GPT, Gemini, Mistral or a local Ollama model just by changing an env var.
"""
from __future__ import annotations

import base64
import json
import logging
import re
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any

from ..config import settings

log = logging.getLogger(__name__)

ROLES = ("tutor", "fast", "verifier", "vision", "judge")

# Models that accept the server-side `fallbacks: "default"` parameter on the Claude API.
_SERVER_FALLBACK = {"claude-opus-5-5", "claude-opus-5", "claude-fable-5-1", "claude-sonnet-5-5"}


class LLMUnavailable(RuntimeError):
    """The role is disabled ("none") or its provider is not configured."""


@dataclass
class LLMResult:
    text: str
    model: str
    refused: bool = False


def model_for(role: str) -> str:
    return getattr(settings(), f"model_{role}", "none") or "none"


def enabled(role: str) -> bool:
    m = model_for(role)
    if m == "none":
        return False
    if _is_claude(m):
        import os

        return bool(os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN"))
    return True  # LiteLLM reports missing keys at call time


def _is_claude(model: str) -> bool:
    return model.startswith("claude-") or model.startswith("anthropic/")


def _claude_id(model: str) -> str:
    return model.split("/", 1)[1] if model.startswith("anthropic/") else model


_anthropic_client = None


def _anthropic():
    global _anthropic_client
    if _anthropic_client is None:
        import anthropic

        _anthropic_client = anthropic.AsyncAnthropic()
    return _anthropic_client


def _claude_kwargs(model: str, system: str, messages: list[dict], max_tokens: int, effort: str | None, json_schema: dict | None, tools: list | None) -> dict[str, Any]:
    kw: dict[str, Any] = {"model": model, "max_tokens": max_tokens, "messages": messages}
    if system:
        kw["system"] = system
    output_config: dict[str, Any] = {}
    if effort:
        output_config["effort"] = effort
    if json_schema:
        output_config["format"] = {"type": "json_schema", "schema": json_schema}
    if output_config:
        kw["output_config"] = output_config
    if tools:
        kw["tools"] = tools
    return kw


async def complete(
    role: str,
    system: str,
    messages: list[dict],
    *,
    max_tokens: int = 4000,
    json_schema: dict | None = None,
    effort: str | None = None,
    tools: list | None = None,
) -> LLMResult:
    """Single completion for a role. `messages` use the Anthropic shape; plain-string content
    and image blocks are translated for LiteLLM providers."""
    model = model_for(role)
    if not enabled(role):
        raise LLMUnavailable(f"role '{role}' is not configured (model={model})")

    if _is_claude(model):
        import anthropic

        mid = _claude_id(model)
        kw = _claude_kwargs(mid, system, messages, max_tokens, effort, json_schema, tools)
        client = _anthropic()
        try:
            if mid in _SERVER_FALLBACK and not json_schema:
                # On a policy decline the API re-runs the request on the recommended model.
                resp = await client.beta.messages.create(**kw, betas=["server-side-fallback-2026-07-01"], fallbacks="default")
            else:
                resp = await client.messages.create(**kw)
        except anthropic.RateLimitError as e:
            raise LLMUnavailable(f"rate limited: {e.message}") from e
        except anthropic.APIConnectionError as e:
            raise LLMUnavailable(f"connection error: {e}") from e
        except anthropic.APIStatusError as e:
            raise LLMUnavailable(f"API error {e.status_code}: {e.message}") from e
        if resp.stop_reason == "refusal":
            return LLMResult(text="", model=resp.model, refused=True)
        text = "".join(b.text for b in resp.content if b.type == "text")
        return LLMResult(text=text, model=resp.model)

    import litellm

    lmsgs = ([{"role": "system", "content": system}] if system else []) + [_to_openai(m) for m in messages]
    kwargs: dict[str, Any] = {"model": model, "messages": lmsgs, "max_tokens": max_tokens}
    if json_schema:
        kwargs["response_format"] = {"type": "json_object"}
    try:
        resp = await litellm.acompletion(**kwargs)
    except Exception as e:  # LiteLLM normalises provider errors into many classes
        raise LLMUnavailable(f"{model}: {e}") from e
    return LLMResult(text=resp.choices[0].message.content or "", model=model)


async def stream(role: str, system: str, messages: list[dict], *, max_tokens: int = 8000, effort: str | None = None, tools: list | None = None) -> AsyncIterator[str]:
    """Yield text deltas. Raises LLMUnavailable before the first token if the role is off."""
    model = model_for(role)
    if not enabled(role):
        raise LLMUnavailable(f"role '{role}' is not configured (model={model})")
    if _is_claude(model):
        mid = _claude_id(model)
        kw = _claude_kwargs(mid, system, messages, max_tokens, effort, None, tools)
        client = _anthropic()
        ctx = (
            client.beta.messages.stream(**kw, betas=["server-side-fallback-2026-07-01"], fallbacks="default")
            if mid in _SERVER_FALLBACK
            else client.messages.stream(**kw)
        )
        import anthropic

        try:
            async with ctx as s:
                async for text in s.text_stream:
                    yield text
                final = await s.get_final_message()
                if final.stop_reason == "refusal":
                    yield "\n\n[The model declined to answer this request.]"
        except anthropic.APIError as e:
            raise LLMUnavailable(f"{mid}: {e}") from e
        return

    import litellm

    lmsgs = ([{"role": "system", "content": system}] if system else []) + [_to_openai(m) for m in messages]
    try:
        resp = await litellm.acompletion(model=model, messages=lmsgs, max_tokens=max_tokens, stream=True)
        async for part in resp:
            delta = part.choices[0].delta.content
            if delta:
                yield delta
    except Exception as e:
        raise LLMUnavailable(f"{model}: {e}") from e


async def complete_json(role: str, system: str, user: str, schema: dict, *, max_tokens: int = 4000) -> Any:
    """Structured JSON output. Claude enforces the schema; other providers get JSON mode + the
    schema in the prompt, and the result is parsed defensively."""
    model = model_for(role)
    sys = system
    if not _is_claude(model):
        sys = f"{system}\n\nReturn ONLY a JSON object matching this JSON Schema:\n{json.dumps(schema)}"
    res = await complete(role, sys, [{"role": "user", "content": user}], max_tokens=max_tokens, json_schema=schema, effort="low" if _is_claude(model) else None)
    if res.refused:
        raise LLMUnavailable("model declined")
    return parse_json(res.text)


def parse_json(text: str) -> Any:
    text = text.strip()
    m = re.search(r"```(?:json)?\s*(.*?)```", text, re.S)
    if m:
        text = m.group(1)
    start = min([i for i in (text.find("{"), text.find("[")) if i >= 0], default=0)
    return json.loads(text[start:])


def image_block(data: bytes, media_type: str) -> dict:
    return {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": base64.b64encode(data).decode()}}


def _to_openai(m: dict) -> dict:
    """Translate an Anthropic-shaped message to the OpenAI/LiteLLM shape."""
    content = m["content"]
    if isinstance(content, str):
        return {"role": m["role"], "content": content}
    parts = []
    for b in content:
        if b.get("type") == "text":
            parts.append({"type": "text", "text": b["text"]})
        elif b.get("type") == "image":
            src = b["source"]
            parts.append({"type": "image_url", "image_url": {"url": f"data:{src['media_type']};base64,{src['data']}"}})
    return {"role": m["role"], "content": parts}


def describe() -> dict:
    return {role: {"model": model_for(role), "enabled": enabled(role)} for role in ROLES}
