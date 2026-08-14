# Shadow Run

**Tier:** micro — one pattern, one property. Twenty to forty lines is the target.

**Chapter:** [Evaluation Patterns · Shadow Run](https://agentshonestly.com/book/patterns/evaluation/shadow-run)

Run the candidate on real traffic and throw its answers away.

## The task

Implement `shadow(traffic)`, returning `{ served, divergences, agreement }`.

`served` maps each request to **production's** answer. `divergences` records every
request where the two disagreed. `agreement` is the fraction that matched, rounded to
four places with `floor(x + 0.5)`.

The property is one line and it is the entire pattern: **`served` is always production.**

`a-better-looking-candidate-answer-still-does-not-reach-the-user` is the case that
enforces it. Production says `i-dont-know` and the candidate says `refund` — the
candidate is *right*, and it still does not get served. The moment a shadow run is
allowed to answer when it looks better, it is not a shadow run: it is an unreviewed
deploy with a heuristic deciding which users are the experiment, and there is no baseline
left to compare against.

`a-candidate-that-fails-does-not-affect-the-user` is the same property from the other
direction, and it is the one that makes shadow runs safe to leave on. The candidate
returned nothing; the user never knew. That asymmetry — full production traffic, zero
production risk — is what you are buying.

The yield is `divergences`. Agreement rate alone tells you a number; the divergence list
tells you which requests to go and look at.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
