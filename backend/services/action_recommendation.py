"""Score and recommend actions based on agent run context."""

from __future__ import annotations

from models import Action, AgentUIRun


def _score_action(action: Action, run: AgentUIRun) -> int:
    """Score an action against a completed run's context.

    Scoring weights:
      +3  use_case rule matches selected_use_case
      +2  keyword rule matches prompt tokens
      +2  skill rule matches skills_used
      +1  confidence rule satisfied
    """
    score = 0
    prompt_tokens = set(run.prompt.lower().split())

    for rule in action.rules:
        if rule.type == "use_case":
            if run.selected_use_case and _match(rule.operator, run.selected_use_case, rule.value):
                score += 3

        elif rule.type == "keyword":
            keywords = {k.strip().lower() for k in rule.value.split(",")}
            if keywords & prompt_tokens:
                score += 2

        elif rule.type == "skill":
            rule_skills = {s.strip().lower() for s in rule.value.split(",")}
            run_skills = {s.lower() for s in run.skills_used}
            if rule_skills & run_skills:
                score += 2

        elif rule.type == "confidence":
            threshold = float(rule.value) if rule.value else 0.0
            if run.confidence is not None and _compare_confidence(rule.operator, run.confidence, threshold):
                score += 1

    return score


def _match(operator: str, actual: str, expected: str) -> bool:
    a, e = actual.lower(), expected.lower()
    if operator == "equals":
        return a == e
    if operator == "not_equals":
        return a != e
    if operator == "contains":
        return e in a
    return False


def _compare_confidence(operator: str, actual: float, threshold: float) -> bool:
    if operator == "greater_than":
        return actual > threshold
    if operator == "less_than":
        return actual < threshold
    if operator == "equals":
        return abs(actual - threshold) < 0.01
    return False


def recommend_actions(
    run: AgentUIRun,
    actions: list[Action],
    threshold: int = 2,
) -> tuple[list[dict], list[dict]]:
    """Return (recommended, available) action lists.

    - recommended: actions with score >= threshold, sorted by score desc
    - available: remaining active actions with score < threshold
    """
    recommended: list[tuple[int, Action]] = []
    available: list[Action] = []

    for action in actions:
        if action.status != "active":
            continue
        score = _score_action(action, run)
        if score >= threshold:
            recommended.append((score, action))
        else:
            available.append(action)

    recommended.sort(key=lambda x: x[0], reverse=True)

    def _serialize(action: Action, score: int | None = None) -> dict:
        d = {
            "id": action.id,
            "name": action.name,
            "description": action.description,
            "integration_id": action.integration_id,
            "operation": action.operation,
            "status": action.status,
        }
        if score is not None:
            d["score"] = score
        return d

    return (
        [_serialize(a, score=s) for s, a in recommended],
        [_serialize(a) for a in available],
    )
