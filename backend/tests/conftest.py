import os
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


@pytest.fixture(scope="session")
def client(tmp_path_factory):
    tmp = tmp_path_factory.mktemp("studynest")
    os.environ["DATABASE_URL"] = f"sqlite:///{tmp}/test.db"
    os.environ["STORAGE_DIR"] = str(tmp / "storage")
    os.environ["EMBEDDING_MODEL"] = "hash"
    for role in ("TUTOR", "FAST", "VERIFIER", "VISION", "JUDGE"):
        os.environ[f"MODEL_{role}"] = "none"  # offline: no API keys needed for the test suite
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as c:
        yield c


OS_TOPICS = [
    ("Introduction to Operating Systems", "An operating system is system software that manages hardware resources and provides common services to applications."),
    ("Process Management", "A process is a program in execution. The process control block (PCB) stores process state, program counter and CPU registers."),
    ("Process Synchronization", "A race condition occurs when correctness depends on the timing of concurrent accesses. A semaphore uses atomic wait and signal."),
    ("Memory Management", "Memory management tracks which regions are free. First-fit, best-fit and worst-fit are common allocation strategies."),
    ("Virtual Memory", "Virtual memory lets a process use an address space larger than physical memory. Too many page faults cause thrashing."),
    ("Paging", "Paging divides logical memory into pages and physical memory into frames. A TLB caches recent translations."),
    ("Segmentation", "The segment table stores a base address and a limit for each segment."),
    ("File Systems", "Common file allocation approaches include contiguous, linked and indexed allocation."),
    ("I/O and Interrupts", "DMA allows a controller to transfer blocks between a device and memory with limited CPU involvement."),
    ("Deadlocks", "A deadlock occurs when a set of processes waits indefinitely. The four necessary conditions are mutual exclusion, hold and wait, no preemption, and circular wait."),
]


@pytest.fixture(scope="session")
def os_pdf(tmp_path_factory) -> Path:
    """A small PDF with the same 'TOPIC NN' structure as the Operating System notes."""
    import pymupdf

    doc = pymupdf.open()
    for n, (title, body) in enumerate(OS_TOPICS, start=1):
        page = doc.new_page()
        text = f"TOPIC {n:02d}\n\n{title}\n\nCORE IDEA\n{body}\n\nWHAT YOU SHOULD KNOW\n• {body}\n"
        page.insert_textbox(pymupdf.Rect(50, 50, 550, 780), text, fontsize=11)
    path = tmp_path_factory.mktemp("pdf") / "Operating_System_Notes.pdf"
    doc.save(path)
    return path
