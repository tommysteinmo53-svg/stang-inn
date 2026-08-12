# Calibration formula

`targetAverage = min(rawAverage, previousAverage * 1.03)`

`marketScale = min(1, targetAverage / rawAverage)`

`finalPrice = roundTo0.5(clamp(rawPlayerEstimate * marketScale, 1, 20))`

This is intentionally transparent so the game-economy adjustment can be inspected separately from the predictive model.
