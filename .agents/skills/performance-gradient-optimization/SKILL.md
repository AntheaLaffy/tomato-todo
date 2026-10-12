---
name: performance-gradient-optimization
description: Use controlled experiments to optimize latency, throughput, CPU, memory, I/O, energy, capacity, or cost, and calibrate performance models. Apply when choosing or verifying performance changes; do not substitute for correctness debugging.
---

# Performance Gradient Optimization

Use "gradient" as an experimental metaphor: diagnose the current system,
choose an informative intervention, and verify its effect. The objective need
not be differentiable, additive, or locally smooth. Keep a verified feasible
champion while exploring alternatives; exploration need not improve monotonically.

Scale the method to the decision. Reuse an adequate project benchmark and its
contract; do not build an elaborate tuning framework for a simple change.
Read supporting guidance only when it changes the experiment:

- [Measurement and acceptance](references/measurement.md): uncertain gains,
  major context changes, repeated candidate selection, workload generalization, or
  service tails.
- [Search strategy](references/search.md): interacting parameters, expensive
  evaluations, approximate tests, or a search that has stopped making progress.
- [Composition models](references/composition.md): projecting a local gain,
  explaining an end-to-end miss, or calibrating a performance model.

## Define the optimization contract

Before changing the implementation, establish:

- the target workload distribution and important strata: request class, input
  shape, concurrency or arrival process, data set, machine, and operating regime;
- one primary objective, its direction, units, and aggregation rule;
- hard constraints such as correctness, quality, tail latency, memory limits,
  deadlines, compatibility, or cost ceilings;
- a minimum useful gain `delta`, based on product value and engineering cost;
- an evaluation protocol: experimental unit, warm-up or cold-start policy,
  pairing, run order, uncertainty method, and stopping rule;
- an experiment budget in time, evaluations, or cost, including final confirmation.

Keep useful gain and measurement precision separate. Noise determines whether
the evidence can resolve `delta`; it does not determine what improvement is
worth shipping. A pilot may guide the sampling plan, but freeze the acceptance
rule before inspecting confirmation results.

Use lexicographic decisions by default: hard constraints first, then the primary
objective, then secondary regression guards. Use a Pareto frontier only when
the product genuinely has multiple coequal objectives. Never hide a failed hard
constraint inside a weighted average.

Maintain per-stratum results for the current champion. A single deployed
implementation must satisfy the whole contract; independent stratum winners
are useful only if they can actually be selected at runtime, including dispatch
cost. When successive accepted changes can accumulate tolerated regressions,
also retain a fixed starting or release anchor and enforce cumulative guards.

Compare candidate and champion in the same fingerprinted context. If a major
change to surrounding code or the software stack, hardware, workload, or
operating conditions invalidates historical comparability, record a new context
and remeasure champion, candidate, and any active guard anchor. Preserve the old
context record, but use the champion's new measurements as the baseline;
reproducing or beating its old score is not an implicit promotion gate. If an
old artifact cannot run, establish a reproducible current baseline and record
the break in comparability. Routine optimization edits or a large candidate
patch that remains comparable do not justify resetting the baseline. A baseline
reset is not an optimization gain. Explicit product targets and required guards
still apply; resolve affected guards before confirmation. Unexplained baseline
instability within the same context is a measurement problem to resolve before
selecting a winner.

## Instrument before choosing a direction

Measure the target workload and descend only as far as needed:

1. primary outcome and end-to-end wall time;
2. resource totals such as CPU time, memory, I/O, energy, and occupied capacity;
3. stage, component, operator, query, or shape timing;
4. sampling profiles, traces, system-call evidence, and hardware counters when
   higher-level measurements leave an unexplained residual.

Profiles show where work or waiting occurs, not necessarily where an
optimization helps. Identify critical-path work, contention, blocking, and the
active resource ceiling. When ranking is ambiguous, use a controlled
perturbation, ablation, or causal profiler where applicable to estimate the
effect of changing a component. Confirm the real implementation end to end.

Rank opportunities by plausible system benefit, uncertainty, controllability,
and implementation/evaluation cost. Source size, operation counts, and a single
fast sample do not establish that ranking. Leave missing evidence unknown.

Check correctness and applicable constraints before admitting a candidate to
performance acceptance. Instrumented runs diagnose; separate minimally
instrumented runs decide. Record profiler overhead and blind spots, including
asynchronous work and overlapping timers.

## Choose and run an experiment

Use one interpretable change for a focused mechanism test. If parameters are
coupled, compare designed combinations and interactions instead of requiring
one-factor-at-a-time improvements. For larger configuration spaces, start with
a small space-filling or random search; use constrained Bayesian optimization
when evaluation cost and reusable observations justify its overhead. Short
runs or reduced workloads may screen candidates, but cannot replace the target
workload at final acceptance.

1. Verify the current-context baseline and state a mechanism plus falsifying
   observations.
2. Choose a candidate or designed set of candidates within the remaining budget;
   retain a reproducible control and a way to restore the champion.
3. Check correctness and constraints, then collect exploration measurements.
4. Freeze the selected candidate and acceptance rule. Confirm with fresh paired
   or blocked runs; randomize or counterbalance order to address time drift.
5. Evaluate all declared strata and guards, including reserved inputs or time
   windows when claiming generalization beyond the tuning workload.
6. Accept, reject, or report inconclusive evidence; use the result to choose the
   next experiment or refine the measurement model.

Repeated iterations in one process are not automatically independent samples.
Account for variation between executions, builds, machines, or time blocks as
appropriate. Preserve startup and sustained behavior when they belong to the
contract; do not assume a fixed warm-up always produces a steady state.

For independently arriving requests, verify the offered load and measure
latency from intended arrival, including queueing. A generator that waits for
slow responses can omit precisely the requests that expose bad tails. Record
achieved load, successful work, errors, timeouts, and generator saturation.
Use a closed-loop generator when that matches the actual user population.

## Decide from evidence

Promote only if correctness, hard constraints, stability, and declared
regression guards pass, and the primary gain is supported under the same
contract as the champion. Normally require a conservative uncertainty bound on
the gain to meet `delta`, rather than just a favorable point estimate. A guard
with insufficient evidence is unresolved, not passed.

Use a planned fixed-sample confirmation by default. For adaptive stopping, use
a valid sequential method with assumptions appropriate to the measurements;
do not repeatedly inspect an ordinary confidence interval until it passes.
Fresh confirmation reduces selection bias but does not by itself control error
across unlimited retries or promotions. Define the error-control scope when
making formal claims over a candidate family or release campaign.

If uncertainty spans the acceptance threshold, improve control or gather the
additional samples permitted by the plan and budget. Otherwise mark the result
inconclusive and keep the champion. Do not lower `delta`, discard valid slow
samples, or change the workload mix to manufacture acceptance. A measured
maximum is an observation, not a worst-case guarantee.

The end-to-end primary outcome is authoritative once constraints pass.
Subsystem metrics explain or rank opportunities; they cannot substitute for
acceptance or veto it unless they are declared guards.

## Use models to diagnose and predict

Choose a model that matches the mechanism: exclusive additive stages, an
execution DAG and its critical path, queueing and capacity, or measured compute
and memory ceilings. Preserve unchanged work and the unmodeled residual. Never
sum nested or overlapping timers as exclusive costs, or use the number of
winning components as evidence of end-to-end gain.

Calibrate predictions against candidate observations not used to fit or select
the model. Track signed residuals and error with measurement uncertainty; set
the acceptable error from the decision's required resolution. A model that
repeatedly misses may guide diagnosis, but cannot support quantitative
forecasts until refined and revalidated. Acceptance still requires measured
end-to-end results.

When local gains fail to reach the primary outcome, inspect the residual,
contention, queueing, and shifted bottlenecks. Add a tracked factor only when it
is repeatably measurable and useful for the decision. Full causal attribution
is not mandatory if the intervention is reproducible and the result is robust.

## Stop and preserve

Stop when the requested target is met, the experiment budget is exhausted, or
the plausible value of another experiment no longer justifies its cost. A local
plateau may justify testing interactions, another algorithm, or another
architecture within scope; it does not prove a global optimum. Expand
instrumentation only when it can resolve a specific decision.

On acceptance, update the champion record and preserve enough to reproduce the
decision: exact commands and configuration, workload and artifact hashes or
immutable identifiers, source revision plus any uncommitted patch, environment
and tool versions, raw samples with run order/block identities, summaries, and
relevant diagnostic
artifacts. Record rejected and inconclusive trials and their reasons so search
history does not become a winners-only account.

Use project storage conventions for large evidence. When producing a milestone
archive, record its checksum and verify the recovery procedure.
Committing, tagging, publishing, and deploying follow the user's authorization
and project workflow; benchmark acceptance alone does not authorize them.

Project instructions provide concrete objectives, thresholds, workloads,
implementation boundaries, tools, and evidence formats. Read them before
acting. Keep project-specific thresholds and architectures in that project;
this method supplies defaults rather than overriding the user's scope.
