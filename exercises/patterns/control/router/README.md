# Router

**Tier:** micro. One pattern, one property. Twenty to forty lines is the target.

**Chapter:** [Control Patterns · Router](https://agentshonestly.com/book/patterns/control/router)

Send the request to the handler that fits it, before spending a model call deciding.

## The task

Implement `route(request, routes, fallback)`.

A route matches when the request contains **any** of its keywords, compared
case-insensitively and **on whole words**. Routes are tried in declaration order and
the first match wins. Nothing matching returns the fallback.

Two rules earn their cases:

- **First match wins, not best match.** `where is my refund` hits both `status` and
  `refund`, and returns `refund` because it is declared first. Scoring the matches and
  picking a winner reads as smarter and makes the route table unreadable. You can no
  longer tell what a request does by looking at it.
- **Whole words.** `creditor references` contains `credit` as a substring and must not
  route to refunds. Substring matching is the bug that turns a router into a source of
  confident mis-routing.

The fallback is not an error path. It is the route for "this needs a person", and it is
always defined.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
