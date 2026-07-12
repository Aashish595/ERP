from typing import Any
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from .client import complete, stream_complete
from .config import get_settings

settings = get_settings()
app = FastAPI(title="School ERP AI Service", version="1.0.0", docs_url=None, redoc_url=None)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[item.strip() for item in settings.CORS_ORIGINS.split(",") if item.strip()],
    allow_methods=["POST", "GET"],
    allow_headers=["Authorization", "Content-Type"],
)


def internal_auth(authorization: str = Header(default="")) -> None:
    if authorization != f"Bearer {settings.AI_SERVICE_TOKEN}":
        raise HTTPException(status_code=401, detail="Invalid service credential")


class TextTask(BaseModel):
    text: str = Field(min_length=1, max_length=30_000)
    tone: str = Field(default="professional", max_length=50)
    audience: str | None = Field(default=None, max_length=100)
    language: str = Field(default="English", max_length=50)


class CurriculumTask(BaseModel):
    subject: str
    grade: str
    duration_weeks: int = Field(ge=1, le=52)
    goals: str | None = None
    context: dict[str, Any] = {}


class LessonTask(BaseModel):
    title: str
    content: str = Field(default="", max_length=100_000)
    transcript: str = Field(default="", max_length=100_000)
    question_count: int = Field(default=10, ge=1, le=30)
    difficulty: str = "medium"
    language: str = "English"


class ChatTask(BaseModel):
    messages: list[dict[str, Any]]
    lesson_context: dict[str, Any] = {}
    user_context: dict[str, Any] = {}


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "provider_configured": bool(settings.api_key)}


@app.post("/internal/notices/generate", dependencies=[Depends(internal_auth)])
async def generate_notice(task: TextTask) -> dict:
    content = await complete(
        "You draft concise school notices. Return only the finished notice with a clear title and body. Do not invent dates or facts.",
        f"Language: {task.language}\nTone: {task.tone}\nAudience: {task.audience or 'school community'}\nDescription:\n{task.text}",
    )
    return {"generated": content}


@app.post("/internal/notices/enhance", dependencies=[Depends(internal_auth)])
async def enhance_notice(task: TextTask) -> dict:
    content = await complete(
        "Improve the supplied school notice without changing its facts. Return only the improved notice.",
        f"Language: {task.language}\nTone: {task.tone}\nNotice:\n{task.text}",
    )
    return {"enhanced": content}


@app.post("/internal/curriculum/generate", dependencies=[Depends(internal_auth)])
async def generate_curriculum(task: CurriculumTask) -> dict:
    content = await complete(
        "Create a practical week-by-week curriculum. Return valid JSON with keys title, objectives, weeks; weeks must be an array of objects with week, topics, outcomes, activities, assessment.",
        task.model_dump_json(),
    )
    try:
        import json
        return json.loads(content.removeprefix("```json").removesuffix("```").strip())
    except Exception:
        return {"title": f"{task.subject} curriculum", "objectives": [], "weeks": [], "raw": content}


@app.post("/internal/lessons/summary", dependencies=[Depends(internal_auth)])
async def summarize_lesson(task: LessonTask) -> dict:
    source = task.transcript or task.content
    summary = await complete(
        "Summarize the lesson for a student. Use headings: Overview, Key points, Important terms, Revision checklist. Stay grounded in the supplied source.",
        f"Title: {task.title}\nLanguage: {task.language}\nSource:\n{source}",
    )
    return {"summary": summary, "source": "transcript" if task.transcript else "content"}


@app.post("/internal/lessons/quiz", dependencies=[Depends(internal_auth)])
async def lesson_quiz(task: LessonTask) -> dict:
    content = await complete(
        "Generate a grounded multiple-choice quiz. Return valid JSON: {questions:[{question,options:[four strings],correct_answer,explanation}]}.",
        f"Count: {task.question_count}\nDifficulty: {task.difficulty}\nLanguage: {task.language}\nTitle: {task.title}\nSource:\n{task.transcript or task.content}",
    )
    try:
        import json
        return json.loads(content.removeprefix("```json").removesuffix("```").strip())
    except Exception:
        return {"questions": [], "raw": content}


@app.post("/internal/chat/stream", dependencies=[Depends(internal_auth)])
async def chat_stream(task: ChatTask) -> StreamingResponse:
    system = (
        "You are a school learning assistant. Use the supplied lesson context, respect the user's role, "
        "say when context is insufficient, and never reveal private data.\n"
        f"Lesson context: {task.lesson_context}\nUser context: {task.user_context}"
    )
    return StreamingResponse(stream_complete(system, task.messages), media_type="text/event-stream")
