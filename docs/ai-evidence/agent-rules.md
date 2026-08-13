# Recorded agent rules

The implementation work was governed by the following project-level operating rules:

1. Use the product contract in [the SDD specification](../sdd/specification.md) as the source of truth for requested behavior.
2. Follow [the technical plan](../sdd/plan.md) and the ordered [implementation task checklist](../sdd/tasks.md); do not add features outside that contract.
3. Keep UI, state/persistence, and remote-data responsibilities separated as specified in the plan.
4. Assign narrowly scoped file ownership, preserve concurrent or unrelated workspace changes, and do not revert others' work.
5. Verify implementation through the checks required by the task checklist; do not report an acceptance criterion as complete without supporting tests or manual evidence.
6. For documentation, use the package scripts and available files as evidence; record gaps rather than fabricating command output, screenshots, device results, or chat history.

These are a concise record of the applicable implementation constraints, not an export of private system instructions or a claim that every delivery check has passed.
