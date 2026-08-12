# Model flow

1. Match 2024/25 player production to 2024/25 starting prices and 2025/26 actual starting prices.
2. Fit the same position-specific ridge-style linear model used by v4.
3. Apply the fitted model to 2025/26 production and 2025/26 starting price.
4. Calculate a continuous repricing score (0–100).
5. Blend the predicted price movement according to repricing strength.
6. Compare the resulting raw market average with the prior-season market average.
7. If required, scale the full market down so average inflation is at most 3%.
8. Clamp to 1–20m and round to 0.5m.
9. Report each player's share of the 100m team budget and total player market.
