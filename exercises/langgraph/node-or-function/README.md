# Node or Function?

**Tier:** drill — a self-contained technique. Nothing outside this directory depends on it.

**Chapter:** [Part VII · Agent & Graph Engineering · Node or Function?](https://agentshonestly.com/book/langgraph/node-or-function)

Not every step deserves to be in the graph.

## The task

Implement `decide(step)`, returning `{ verdict, reasons }`.

A step becomes a **node** if it has a side effect, if the run must be able to resume
after it, or if it needs its own trace span. Otherwise it stays a plain **function**.
`reasons` lists which applied, in that order.

`being-slow-alone-does-not-make-it-a-node` is the case that does the work. Slowness is
the reason people reach for a node, and on its own it buys nothing: a slow pure
computation re-runs identically on replay, costs the same whether or not it is a node,
and adds a checkpoint write plus a state entry to every run in exchange. If it is slow
*and* you want to see its timing, that is the observability reason — say that instead.

The three that do matter are all about **what happens on the second run**. A side effect
must not be repeated; resumption needs a boundary to restart from; observability needs a
span that exists whether or not the step succeeded. Every one of them is a property of
replay, and a plain function has none of them because a plain function leaves no trace to
replay against.

Both directions cost something. Making everything a node bloats the checkpoint with state
nobody reads and turns a readable function into a graph you navigate. Making nothing a
node means a crash resumes from the top and repeats the effect. `reasons` exists so the
choice is written down rather than argued about later.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
