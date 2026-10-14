"""Tokenisation shared by retrieval, chunking and evaluation (mirrors the frontend's tokenizer)."""
import re

STOP = set(
    """a an the of to in on for and or is are was were be been it this that with as by at from me my i you your what why how
    when which who do does did can could should would explain concept simple simply please give tell about into using use
    between difference vs versus show diagram notes note create make summarize summary chapter generate important practice
    questions question solve problem topic with mind map""".split()
)


def tokenize(text: str) -> list[str]:
    words = re.sub(r"[^a-z0-9\s-]", " ", text.lower()).split()
    out = []
    for w in words:
        if len(w) <= 1 or w in STOP:
            continue
        if len(w) > 4 and w.endswith("s") and not w.endswith("ss"):
            w = w[:-1]
        out.append(w)
    return out


def sentences(text: str) -> list[str]:
    return [s.strip() for s in re.split(r"\n+|(?<=[.!?])\s+", text) if len(s.strip()) > 12]
