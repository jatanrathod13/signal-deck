# Product Direction: Signal Deck

## One-line definition

Signal Deck is an open-source AI execution control plane for turning team objectives into governed, observable outcomes.

## The problem

Teams can generate AI responses, but they still struggle with:

1. Breaking objectives into reliable execution plans
2. Running multi-step workflows safely
3. Understanding what happened when runs fail
4. Operating AI systems with production controls

## The core promise

Given a natural-language objective, Signal Deck should:

1. Plan the execution steps clearly
2. Execute with the right runtime/tooling mode
3. Pause when human approval is required
4. Finish with verifiable artifacts and timeline evidence

## Target users

1. Engineering teams automating technical execution workflows
2. Platform/SRE teams operating AI-assisted runbooks
3. AI product teams needing observability and governance around agent runs

## What makes this different

1. Execution-first architecture (queue + worker + orchestration), not a chat wrapper
2. Built-in governance and reliability controls
3. Operational visibility with run phases, artifacts, and readiness surfaces
4. Open-source extensibility for integrations and execution profiles

## Product boundaries

Signal Deck prioritizes:

- Objective orchestration
- Runtime control and safety
- Operational diagnostics

Signal Deck does not prioritize:

- Standalone chatbot UX without execution context
- Consumer assistant features
- Uncontrolled feature expansion without measurable run quality gains

## North-star workflow

1. User submits objective in Workspace
2. Run starts and root task is queued
3. Orchestrator creates plan (sequential/parallel/DAG)
4. Worker executes steps and emits events
5. Governance gates risky operations
6. Run completes with summary, events, and artifacts

## Quality bar for roadmap work

A feature is valuable only if it improves at least one of:

1. Completion reliability
2. Observability quality
3. Governance safety
4. Operator productivity
5. Open-source adoption velocity

