# V4.1 acceptance cases

Manual acceptance checks for the browser diagnostic:

1. Raw average <= old average * 1.03: scale must be 100%.
2. Raw average > old average * 1.03: scale must be below 100% and target average capped at +3%.
3. Final prices stay between 1m and 20m and round to 0.5m.
4. `% av 100m` equals final price for a 100m budget (e.g. 14.5m = 14.5%).
5. `% av spillermarked` sums to approximately 100% before display rounding.
6. Repricing score varies continuously rather than only returning 5/15/60.
7. A cheap player with high PPG and 35+ games should receive a materially higher repricing score than a similarly priced player with low PPG.
8. Low game count must dampen the repricing score.
