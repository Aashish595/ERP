import json
from collections.abc import AsyncIterator
import httpx
from fastapi import HTTPException
from .config import get_settings


async def complete(system: str, user: str, *, temperature: float = 0.3) -> str:
    settings = get_settings()
    if not settings.api_key:
        raise HTTPException(status_code=503, detail="AI provider is not configured")
    async with httpx.AsyncClient(timeout=settings.AI_TIMEOUT_SECONDS) as client:
        response = await client.post(
            f"{settings.provider_base_url.rstrip('/')}/chat/completions",
            headers={"Authorization": f"Bearer {settings.api_key}", "Content-Type": "application/json"},
            json={
                "model": settings.provider_model,
                "temperature": temperature,
                "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
            },
        )
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail="AI provider request failed")
    payload = response.json()
    return payload["choices"][0]["message"]["content"].strip()


async def stream_complete(system: str, messages: list[dict]) -> AsyncIterator[str]:
    settings = get_settings()
    if not settings.api_key:
        yield f"data: {json.dumps({'error': 'AI provider is not configured'})}\n\n"
        return
    async with httpx.AsyncClient(timeout=settings.AI_TIMEOUT_SECONDS) as client:
        async with client.stream(
            "POST",
            f"{settings.provider_base_url.rstrip('/')}/chat/completions",
            headers={"Authorization": f"Bearer {settings.api_key}", "Content-Type": "application/json"},
            json={"model": settings.provider_model, "stream": True, "messages": [{"role": "system", "content": system}, *messages]},
        ) as response:
            if response.status_code >= 400:
                yield f"data: {json.dumps({'error': 'AI provider request failed'})}\n\n"
                return
            async for line in response.aiter_lines():
                if not line.startswith("data: "):
                    continue
                raw = line[6:]
                if raw == "[DONE]":
                    yield f"data: {json.dumps({'status': 'done'})}\n\n"
                    return
                try:
                    chunk = json.loads(raw)["choices"][0]["delta"].get("content")
                    if chunk:
                        yield f"data: {json.dumps({'token': chunk})}\n\n"
                except (KeyError, IndexError, json.JSONDecodeError):
                    continue
