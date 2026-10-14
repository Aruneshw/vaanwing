"""Bayesian Knowledge Tracing — the learner model (same parameters as the frontend)."""
SLIP, GUESS, LEARN = 0.1, 0.2, 0.12
PRIORS = {"beginner": 0.2, "some": 0.35, "confident": 0.5}


def update(p: float, correct: bool) -> float:
    if correct:
        post = p * (1 - SLIP) / (p * (1 - SLIP) + (1 - p) * GUESS)
    else:
        post = p * SLIP / (p * SLIP + (1 - p) * (1 - GUESS))
    return min(0.99, max(0.01, post + (1 - post) * LEARN))
