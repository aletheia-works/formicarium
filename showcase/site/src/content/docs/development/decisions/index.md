---

title: Architecture decisions
description: The decisions that shape the runtime, one record each.
sidebar: { label: Overview, order: 0 }
---

Each record states the context, the decision, its consequences and the
alternatives rejected. To add a decision, create the next number and add a row
here. To reverse one, mark the old record as superseded by the new number and
give the reason in the new record.

| Number                                                                                    | Decision                                               | Status             |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------ |
| [0002](/formicarium/development/decisions/0002-interpreter-only-jit-deferred/)            | Interpreter only; defer the JIT                        | Accepted           |
| [0003](/formicarium/development/decisions/0003-core-boundary/)                            | Handle the core only as one wasm module and its loader | Accepted           |
| [0007](/formicarium/development/decisions/0007-no-guest-network-in-browser/)              | No guest network in the browser                        | Superseded by 0014 |
| [0008](/formicarium/development/decisions/0008-fresh-instance-per-step/)                  | A fresh core instance for each step                    | Accepted           |
| [0010](/formicarium/development/decisions/0010-wasm-memory-1gb/)                          | Cap the wasm memory at 1 GB                            | Accepted           |
| [0011](/formicarium/development/decisions/0011-host-baseline-in-measurements/)            | Record a host speed baseline with each measurement     | Accepted           |
| [0013](/formicarium/development/decisions/0013-interactive-guest-runs/)                   | Interactive guest runs with stdin and a terminal       | Accepted           |
| [0014](/formicarium/development/decisions/0014-guest-tcp-clients-in-nodejs/)              | Guest TCP clients in Node.js                           | Accepted           |
| [0015](/formicarium/development/decisions/0015-guest-network-in-browser-through-a-relay/) | Guest network in the browser through a WebSocket relay | Accepted           |

The decisions specific to the former blink core (0001, 0004, 0005, 0006, 0009
and 0012) were removed with it; they remain in the git history. Their numbers
are not reused.
