# Market calibration parameters

`TEAM_BUDGET_M = 100` is the assumed 19Fantasy team budget.

`MAX_AVG_INFLATION = 0.03` is deliberately conservative. It does not force prices to rise 3%; it only caps the market-wide average increase. If the raw model average is flat or lower, no upward scaling is applied.

This keeps the model relative: strong performers can become more expensive, but widespread price increases are compressed so roster construction remains comparable when the team budget is unchanged.
