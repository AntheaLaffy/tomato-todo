# Composition models

Use when predicting end-to-end effects or explaining why a local improvement
missed the primary objective. Models are diagnostic and forecasting tools;
measured end-to-end results determine acceptance.

## Additive stages and Amdahl's check

For positive costs in mutually exclusive sequential stages, use a consistent
parent profile. Let `r_i = candidate_i / baseline_i`. For the modeled interval:

`predicted_cost_ratio = sum(weight_i * r_i)`

Normalize `weight_i` over that interval. This ratio predicts the interval, not
the full program. For an end-to-end projection, retain unchanged work:

`predicted_total_ratio = unchanged_share + sum(parent_share_i * r_i)`

Here the parent shares refer to exclusive baseline contributions to the same
end-to-end cost. Include overhead explicitly or leave it in the residual, and
report the accounted share. Do not normalize covered shares to 100% and then
silently claim all execution was modeled. Missing costs are unknown, not zero.

Nested spans, overlapped GPU work, and concurrent CPU threads cannot be added
as exclusive wall-time shares. Throughput rates also cannot be substituted for
cost ratios without a justified service/capacity model.

For an isolated local speedup `s` affecting exclusive baseline share `p`,
Amdahl's prediction is:

`total_speedup = 1 / ((1 - p) + p / s)`

For example, speeding up a 20% stage by 2x predicts `1 / 0.9`, about 1.11x,
not 2x overall. The formula assumes unaffected work stays unchanged. A result
outside propagated measurement uncertainty calls for investigating changed
shares, interaction effects, layout, scheduling, or missing costs, rather than
rewriting the baseline shares to match the observation.

## Parallelism and critical paths

Reconstruct the execution DAG from appropriate traces. Use measured critical
paths or work/span limits, and consider resources shared by concurrent stages.
Speeding a stage outside the critical path has no predicted latency benefit
unless it changes contention or scheduling. Total sampled CPU time need not
equal elapsed time.

Repeat the analysis after a successful change: the critical path or active
bottleneck may have moved. An ablation or controlled speedup can test whether
an apparent hotspot controls the primary metric. Virtual speedups from causal
profiling still need confirmation with an actual implementation change.

## Queueing and sustainable capacity

Separate service time from waiting, admission, backpressure, and synchronization.
Measure arrivals, successful departures, utilization, queue depth, and latency
at the same operating point. Little's Law `L = lambda * W` is a consistency check
for matching population boundaries and a stable flow. It does not linearize
waiting time near saturation or describe a queue growing without bound.

Measure a load-response curve around the target regime when capacity or tails
matter. A reduced service time may increase capacity but have little effect on
latency far below saturation, or a large effect near it. Do not apply a queueing
formula whose arrival/service assumptions have not been checked.

## Resource ceilings

Use Roofline or a measured CPU execution-cache-memory model when compute,
data movement, or overlap limits the workload. Use relevant sustained ceilings
and working-set behavior, rather than nominal marketing peak values.

These models can rank opportunities such as reducing transfers, improving
reuse, vectorizing, or changing precision within quality constraints. They
do not by themselves account for launch overhead, queueing, communication,
synchronization, or an entire application. Identify those composition terms
before making an end-to-end prediction.

## Validate predictions and investigate residuals

Store predictions before observing confirmation data. Track signed residual
`observed - predicted` and relative error `abs(observed - predicted) / observed`
when the observed quantity is positive; use absolute error when a relative
denominator is zero or unsuitable. Propagate uncertainty from underlying
measurements and preserve covariance for shared or paired observations.

Choose tolerance from measurement precision and the resolution needed for the
decision. Validate on observations not used to fit or select the model. A
revised model needs new validation; explaining the observation used to revise
it is not predictive success.

If misses recur, use the model for qualitative diagnosis until it is calibrated.
Inspect the unmodeled residual, overlap, contention, load regime, and overhead.
Track a newly observed factor when it is measurable and changes the next
decision. Distinguish observed mechanisms from plausible explanations and
avoid multiplying shares by invented confidence or controllability weights.

## Causal-profiling source

Curtsinger and Berger, [Coz: Finding Code that Counts with Causal Profiling](https://github.com/plasma-umass/coz)
(SOSP 2015; project documentation checked 2026-10-08): conventional profiles
measure time spent, while causal profiling estimates the effect of potential
speedups through interventions. Use this idea when ordinary hotspot ranking
does not explain end-to-end performance; Coz itself is an optional tool.
