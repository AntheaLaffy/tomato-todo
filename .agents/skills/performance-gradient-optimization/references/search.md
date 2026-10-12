# Search strategy

Read when parameters interact, experiments are expensive, or local progress
stalls. Choose a search method proportional to the available budget and evidence.

## Match the search to the question

| Situation | Useful starting method | Important limit |
| --- | --- | --- |
| One localized mechanism with a clear counterfactual | Controlled change or ablation | Local timing alone cannot establish system benefit |
| A few potentially coupled knobs | Factorial or fractional-factorial design | Check which interactions are estimable or aliased |
| Many settings and inexpensive trials | Random or space-filling exploration, then refinement | Preserve a budget for confirmation |
| Expensive trials with reusable configuration observations | Constrained Bayesian optimization | Model overhead, noise, and misspecification can outweigh savings |
| Useful cheaper approximations to the target experiment | Multi-fidelity screening or search | Rankings and feasibility can change with fidelity |
| Workloads or regimes change materially | Context-specific retesting; contextual models if justified | Transfer is a hypothesis, not evidence of performance in the new context |

Single-change experiments are valuable for attribution. They are not a universal
search algorithm. For two factors, compare baseline, A, B, and A+B when plausible
interactions justify it. For example, timings of `100, 102, 101, 85 ms` show that
both isolated changes lose while their combination wins. Keep the verified
champion during these experiments; evaluate the combination as a new candidate.
This does not authorize promoting a losing intermediate implementation.

Use replication and randomized blocks to distinguish interactions from noise
and drift. Fractional designs reduce trial count by confounding some effects;
record that structure rather than claiming every interaction was identified.
Pruning apparently weak knobs too early can discard a useful joint effect.

If the response changes abruptly at cache capacity, spill thresholds, compiler
dispatch, or saturation, explore those regimes explicitly. Local smoothness and
a directional derivative can be misleading across such boundaries.

## Use a surrogate only when it earns its cost

For automated tuning, define feasible parameter ranges, categorical choices,
dependencies, the measured objective, constraints, and per-trial cost. Start
from a known feasible control and a small diverse sample. Store invalid and
failed configurations with their reasons; do not label them as fast because
they completed less work.

Compare model-guided proposals against a simple random or space-filling search
using comparable evaluation budgets. Model fitting, acquisition optimization,
builds, restarts, warm-up, and switching configurations all consume resources.
Treat a noise-aware surrogate as a proposal mechanism, not a substitute for
measured constraint checks and final acceptance.

For expensive noisy objectives, constrained Bayesian optimization can balance
likely gain, uncertainty, feasibility, and evaluation cost. Use a supported
implementation and its documented assumptions rather than asking an agent to
invent an acquisition formula. A modeled probability of feasibility is not a
guarantee that exploratory configurations satisfy hard limits. Use offline or
isolated evaluation when the exploration cannot stay within the live contract.

If language models suggest algorithms, knobs, or parameter dependencies, record
them as hypotheses. Domain knowledge can narrow an initial search, but rankings,
claimed speedups, and acceptance must come from measurements. Do not require an
LLM tuner, reinforcement learner, or Bayesian model merely because it is newer.

## Use cheaper tests without changing the target

Possible fidelities include shorter duration, fewer inputs, smaller shapes,
reduced concurrency, isolated kernels, or a simulator. Label each observation
with its fidelity and context. Cheap tests can screen or help allocate trials;
only the declared target workload can establish acceptance.

Before relying on a proxy, compare proxy and target measurements on diverse
candidate configurations. Check ranking reversals, guard failures, and whether
error changes across parameter or workload regions. A proxy that tracks compute
cost below cache capacity may fail above it. A short run may miss thermal
throttling; low concurrency may omit queueing collapse.

Recheck promising and ambiguous candidates at target fidelity. Do not discard
whole search regions based on an unvalidated approximation. Stop using a proxy
for quantitative predictions when its held-out errors exceed the decision's
resolution, and do not mix proxy and target data as interchangeable samples.

If an objective really is a network of independently evaluable components,
partial evaluations may reduce cost. Establish those dependencies and the
ability to evaluate nodes independently first. Overlapping application stages
or queueing systems are not automatically such a function network.

## Budget exploration and stopping

Reserve final-confirmation resources before spending the budget on search.
Record actual evaluation and switching costs, and keep failed or inconclusive
trials in the history. A sample-count budget can be misleading when trial costs
vary by configuration.

At a plateau, distinguish poor evidence, a coupled search direction, a moved
bottleneck, and an algorithmic limit. Run a discriminating experiment when the
answer would change the next action. Consider another algorithm or architecture
within scope when local tuning cannot plausibly reach the target.

Stop at the user's target or budget. Earlier stopping can be justified when
plausible remaining improvement is worth less than its evaluation and adoption
cost. Translate performance into value only if the project provides a credible
conversion; otherwise use explicit gain ranges and costs. Do not turn an
uncalibrated expected-improvement number into a universal stopping guarantee.

## Evidence behind these choices

Sources checked 2026-10-08. The general workflow is a practical synthesis; the
papers' numerical results and guarantees are specific to their experiments and
models, not promised improvements for an arbitrary project.

- NIST, [One variable at a time](https://www.itl.nist.gov/div898/handbook/pri/section2/pri212.htm):
  one-factor-at-a-time exploration does not reveal factor interactions. This
  foundation predates the recent autotuning papers and remains relevant.
- Letham et al., [Constrained Bayesian Optimization with Noisy Experiments](https://arxiv.org/abs/1706.07094)
  (Bayesian Analysis 2019): model noise in objectives and constraints; the paper
  includes compiler-flag tuning as a systems application.
- Fan et al., [Multi-fidelity Bayesian Optimization with Multiple Information Sources of Input-dependent Fidelity](https://proceedings.mlr.press/v244/fan24a.html)
  (UAI 2024): approximation quality can vary across the input domain. This
  motivates checking proxy reliability by region rather than globally.
- Buathong and Frazier, [Fast Bayesian Optimization of Function Networks with Partial Evaluations](https://proceedings.mlr.press/v293/buathong25a.html)
  (AutoML 2025): partial evaluations can save expensive queries when the
  objective has the required network structure; search computation also costs.
- Xie et al., [Cost-aware Stopping for Bayesian Optimization](https://proceedings.mlr.press/v306/xie26c.html)
  (ICML 2026; preprint 2025): optimize the trade-off between solution quality and
  evaluation cost. The guarantees depend on the specified stopping policy and
  acquisition functions, not an arbitrary manual search loop.
