"""Section-aware chunking. Input segments carry their location (page / slide / timestamp);
every output chunk keeps it so answers can cite the exact spot."""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from ..text import tokenize


@dataclass
class Segment:
    location: str  # "p. 3", "Slide 4", "12:40"
    text: str
    topic: str = ""
    modality: str = "text"


@dataclass
class ChunkDraft:
    location: str
    topic: str
    text: str
    keywords: list[str] = field(default_factory=list)
    modality: str = "text"


HEADING = re.compile(r"^[A-Z][A-Z0-9 /&'’()–-]{2,40}$")
GENERIC_HEADS = {"CORE IDEA", "WHAT YOU SHOULD KNOW", "EXAM SNAPSHOT", "WORKED THINKING", "RAPID REVISION", "STEP-BY-STEP"}
BOILERPLATE = [
    re.compile(r"Remember: define the concept", re.I),
    re.compile(r"Define .{3,60} in one sentence", re.I),
    re.compile(r"^Exam method:", re.I),
    re.compile(r"reproduce the central diagram|formula/rule before substituting|main components and the order", re.I),
]
ACRONYMS = {"TLB", "PCB", "CPU", "DMA", "OS", "I/O", "RAM", "MMU", "FCFS", "SJF", "SSTF", "SCAN", "C-SCAN", "LOOK", "RPC", "RAID"}
MAX_CHARS = 700


def title_case(s: str) -> str:
    return " ".join(w if w in ACRONYMS else w[:1] + w[1:].lower() for w in s.split())


def _clean(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


def _strip_diagram_labels(text: str) -> str:
    """Figure labels extracted as text come out as runs of capitalised fragments."""
    out = []
    for sent in re.split(r"(?<=[.!?:])\s+", text):
        toks = sent.split(" ")
        rest = sent.split(" ", 1)[1] if " " in sent else ""
        if not re.search(r"[a-z]{3,}", rest) and not re.search(r"[.!?]$", sent):
            continue
        k = 0
        while k < len(toks) and (re.match(r"^[A-Z0-9#+/&(]", toks[k]) or len(toks[k]) <= 2):
            k += 1
        if 5 <= k < len(toks):
            sent = " ".join(toks[k - 1 :])
        elif k == len(toks) and not re.search(r"[.!?]$", sent):
            continue
        out.append(sent)
    return " ".join(out)


def _keywords(text: str, extra: list[str]) -> list[str]:
    freq: dict[str, int] = {}
    for w in tokenize(text):
        if len(w) > 3 and not w.isdigit():
            freq[w] = freq.get(w, 0) + 1
    top = [w for w, _ in sorted(freq.items(), key=lambda kv: -kv[1])[:8]]
    return list(dict.fromkeys(extra + top))


def _split_long(text: str) -> list[str]:
    if len(text) <= MAX_CHARS:
        return [text]
    parts, cur = [], ""
    for s in re.split(r"(?<=[.!?])\s+", text):
        if len(cur) + len(s) > MAX_CHARS and cur:
            parts.append(cur.strip())
            cur = ""
        cur += s + " "
    if cur.strip():
        parts.append(cur.strip())
    return parts


def chunk_segments(segments: list[Segment]) -> list[ChunkDraft]:
    out: list[ChunkDraft] = []
    for seg in segments:
        topic = seg.topic or _clean(seg.text.split("\n", 1)[0])[:60] or seg.location
        topic_words = tokenize(topic)
        if seg.modality != "text":
            for part in _split_long(_clean(seg.text)):
                out.append(ChunkDraft(seg.location, topic, part, _keywords(part, topic_words), seg.modality))
            continue
        sections: list[tuple[str, list[str]]] = [("", [])]
        for raw in seg.text.split("\n"):
            line = raw.strip()
            if not line:
                continue
            if HEADING.match(line) and not re.match(r"^TOPIC \d+$", line) and line == line.upper():
                sections.append((line, []))
            else:
                sections[-1][1].append(line)
        for head, body in sections:
            text = _clean(" ".join(body))
            text = re.sub(r"^\d+\s+", "", text)
            text = re.sub(r"\s+\d+$", "", text)
            text = _strip_diagram_labels(text)
            if not head:
                text = re.sub(r"^TOPIC \d+\s+", "", text).replace(topic, "", 1)
                text = re.sub(r"^\s*Quick revision, comparison and worked thinking\s*", "", text).strip()
            if any(p.search(text) for p in BOILERPLATE):
                kept = [x for x in re.split(r"(?<=[.!?])\s+|\s*•\s*", text) if x and not any(p.search(x) for p in BOILERPLATE)]
                text = " ".join(kept)
            if len(text) < 40:
                continue
            label = title_case(head) if head else ""
            ctopic = f"{topic}: {label}" if head and head not in GENERIC_HEADS else topic
            for part in _split_long(text):
                body_text = f"{label} — {part}" if label else part
                out.append(ChunkDraft(seg.location, ctopic, body_text, _keywords(part, topic_words + (tokenize(head) if head else []))))
    return out
