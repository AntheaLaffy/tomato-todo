# Measurement and acceptance

Use this reference for small or uncertain gains, repeated search, generalization,
major context changes, and service latency. Choose the relevant sections; a large
obvious gain need not use every statistical technique below.

## Define what the result estimates

Specify the population and the aggregation before tuning. A fixed input measures
performance on that input. A claim about production needs representative inputs,
load levels, and operating regimes, including important rare classes.

Keep workload weights fixed during a comparison. Report stratum results beside
the aggregate so an improvement in common requests does not conceal a required
guard failure in rare requests. Aggregate raw work, time, or cost according to
the product objective; averaging percentage speedups can answer a different
question. A mixture's p99 is not the weighted mean of stratum p99 values.

Compare successful work per unit time when failures or dropped work are possible.
For capacity under an SLO, measure the highest sustainable offered load that
satisfies the SLO and error limits, rather than unconstrained peak throughput.

## Reestablish a baseline after a major context change

Major changes to surrounding code, execution backends, core dependencies, or
build/runtime configuration can invalidate historical comparisons even on the
same hardware. Hardware or target workload changes can do so as well. Record
what changed and why it affects comparability; patch size or a disappointing
score alone does not establish a new context. Ordinary optimization edits and
large candidate rewrites that remain comparable still require the existing
champion comparison.

Fingerprint the new context and measure both alternatives there. The historical
champion is an implementation to retest; its old score alone is not a comparable
acceptance threshold. Preserve the old measurements with their context instead
of overwriting them or pooling them with new samples.

If an old champion or guard anchor cannot run, document the reason and establish
a feasible, reproducible current baseline. Define any necessary replacement for
an affected guard in the contract before confirmation; until then, that guard
remains unresolved. Do not claim cumulative non-regression against an unmeasured
anchor. Establishing a new baseline is not a performance improvement, and does
not automatically relax product constraints or the minimum useful gain.

For example, after a major runtime migration on the same hardware, an old
latency of 100 ms may become 150 ms for the same champion. A candidate measured
at 135 ms under that new runtime has a 10% gain against the current baseline;
it need not beat 100 ms unless the contract explicitly requires that absolute
target. Promotion still requires the planned uncertainty bound and all
applicable constraints to pass.

## Repeat the unit that actually varies

Use a pilot to identify whether uncertainty arises between iterations,
executions, builds, machines, or time windows. Allocate repetition to those
levels. A million requests in one process do not replace independent process
or time-block replication when state or common disturbances affect them all.

Pair candidate and champion on comparable inputs and context. Randomize AB/BA
order within blocks or use a justified counterbalanced design. Save order and
block identifiers. Interleaving alone does not remove carryover from cache
state, compilation, a shared database, or thermal history; specify resets or
washout periods when those effects would bias the comparison.

Inspect the time series as well as the summary. Distinguish cold start,
initialization, JIT changes, steady operation, and sustained thermal behavior.
Use a prespecified warm-up rule or duration matching the contract. If the system
does not reach a steady state, report and test that behavior rather than
trimming observations until the curve looks flat.

Hold relevant conditions comparable, but preserve variation that belongs to the
target deployment. Pinning threads or suppressing background work may improve a
diagnostic experiment without supporting a claim about an unpinned shared host.
When drift changes the context, remeasure both alternatives under the new
context; do not silently delete unfavorable blocks. Keep invalid-run reasons.

## Estimate the gain and guard margins

Define the gain so positive means better. For positive-valued summaries `B`
(champion) and `C` (candidate), common choices are:

- lower is better: `G = 1 - C / B`;
- higher is better: `G = C / B - 1`.

State whether these are ratios of aggregate totals, means, or another declared
statistic. Estimate uncertainty for that actual estimand. A geometric mean of
per-input ratios is useful for some benchmark-suite comparisons, but need not
estimate production time saved. Do not switch estimands after seeing the data.

Use an interval method suited to the sample hierarchy and distribution, such as
paired analysis or a justified cluster/block bootstrap. Resample the independent
units and preserve pairing. An IID request bootstrap is invalid when shared
state or bursts create dependence. A bootstrap does not repair selection bias,
context drift, or an inadequate tail sample.

Choose evidence strength from the decision's stakes and required resolution.
Normally accept only when the conservative lower bound on `G` reaches `delta`.
For an upper-limit guard, the conservative upper bound must satisfy the limit.
For a relative regression guard, evaluate the allowed margin explicitly;
failure to find a statistically significant regression is not proof of passing.

Use three outcomes:

| Evidence | Decision |
| --- | --- |
| Gain clears `delta`; correctness and all guards pass | Accept |
| A violation is established, or gain cannot meet the useful threshold | Reject |
| The interval crosses a threshold, or a required guard remains unresolved | Inconclusive; retain champion |

For example, with `delta = 2%`, estimated gain `3%` and interval `[0.5%, 5.5%]`
are insufficient for acceptance. A gain interval `[2.2%, 3.8%]` clears that gate
if every other constraint also passes. These are illustrative thresholds, not
defaults for all projects.

## Separate search from confirmation

There are three distinct forms of validation:

1. **Fresh measurement confirmation:** freeze a selected candidate and measure
   it on new runs. This reduces bias from selecting the fastest noisy trial.
2. **Workload generalization:** reserve inputs, traces, or time windows that did
   not guide tuning when the claim extends beyond the tuning workload. Reusing
   the same inputs with fresh timing samples addresses noise, not input overfit.
3. **Model validation:** test predictions on candidate observations that did not
   fit or select the predictive model. This validates the model, not a release.

If a holdout result guides another change, it has become development evidence.
Use new confirmation or a justified reuse procedure for the next claim. A narrow
fixed-workload task can state its limited scope instead of inventing an unrelated
holdout population.

Plan fixed-sample confirmation using pilot variance and the budget. Inspecting
ordinary fixed-sample intervals after each new sample and stopping at the first
pass breaks their stated coverage. If early decisions are needed, use a valid
group-sequential procedure or confidence sequence for the actual estimand and
its assumptions. A confidence sequence for a mean does not automatically give
one for p99, a ratio, or an arbitrary dependent time series.

For formal claims across many candidate comparisons or repeated promotions,
define the family and error budget, then choose an appropriate multiplicity or
alpha-spending procedure. Fresh confirmation and time-uniform inference do not
automatically protect an unlimited family of adaptively chosen claims. Avoid
implying campaign-wide confidence from separate nominal 95% intervals.

When the planned data cannot resolve the useful gain within budget, improve the
harness or report inconclusive evidence. Additional exploratory runs may inform
a future plan; they do not retroactively validate a failed stopping rule.

## Measure service tails under the right load

Choose the arrival model from the use case:

- Independently arriving traffic needs an arrival schedule that does not slow
  down just because the server stalls. Measure from intended arrival to
  completion, accounting for queueing and missed or delayed issuance.
- A bounded population that waits before making another request can legitimately
  use closed-loop load. State that population and think-time model; its result
  does not estimate latency at a fixed external arrival rate.

Record offered and achieved rates, concurrent work, queue depth where available,
successful completions, errors, timeouts, and load-generator headroom. Equal
concurrency does not imply equal offered load. A post-hoc histogram correction
can diagnose omission, but cannot recreate the load that never reached the
server or prove behavior under that missing contention.

Do not compute an optimistic tail only from successful completions while
silently censoring slow timeouts or dropped requests. Count deadline misses and
record censoring; unknown completion times remain unknown. Ensure the run and
drain policy cover outstanding work consistently.

For percentile `q`, `N * (1 - q)` gives the approximate number of observations
beyond that percentile, not a precision guarantee. With 1,000 observations,
p99.9 has roughly one observation in that tail. Include independent windows
and sufficient duration to expose stalls, bursts, and sustained load. Report
tail uncertainty and miss-rate bounds when those determine acceptance. An
observed maximum cannot establish a hard worst-case bound.

## Evidence behind these choices

Sources checked 2026-10-08. The procedures above adapt these results to systems
optimization; they do not inherit guarantees without the sources' assumptions.

- Kalibera and Jones, [Rigorous Benchmarking in Reasonable Time](https://kar.kent.ac.uk/33611/)
  (ISMM 2013): allocate repetition where uncertainty arises and report effect
  sizes with uncertainty. The repository supplies a corrected paper version.
- Barrett et al., [Virtual Machine Warmup Blows Hot and Cold](https://theunixzoo.co.uk/pubs/pdf/barrett2017warmup.pdf)
  (OOPSLA 2017): a steady peak-performance phase is not guaranteed by warm-up.
- Howard et al., [Time-uniform, nonparametric, nonasymptotic confidence sequences](https://arxiv.org/abs/1810.08240)
  (Annals of Statistics 2021): time-uniform intervals enable valid stopping
  under stated assumptions; this is separate from testing many candidates.
- Dwork et al., [The reusable holdout: Preserving validity in adaptive data analysis](https://research.ibm.com/publications/the-reusable-holdout-preserving-validity-in-adaptive-data-analysis)
  (Science 2015): adaptive feedback can invalidate naive holdout reuse. Ordinary
  benchmark reruns are not an implementation of the paper's reuse mechanism.
- Gil Tene, [wrk2 measurement design](https://github.com/giltene/wrk2): intended
  arrival time and coordinated omission matter for latency. Its technique is
  evidence for the measurement principle, not a requirement to use this tool.
