# Tracker v2.6 — fix stage: owner decisions (2026-10-04)

Request: staff B must be able to fix staff A's stage of a cut (e.g. C1 LO) on any date. Today the
project has a separate FI work type at the end of the order, which the pipeline order rule blocks
from sitting on the same dates as LO.

Q0 Fix target: **one stage of a cut** (e.g. "C1 LO fix"); several fixes per stage allowed; any dates.

Decision page: https://claude.ai/artifact/51bpUAjmRM4En5Pfc3FyGb

| ID | Decision | Answer |
|----|----------|--------|
| D1 | Pay for a fix | A — fix pays nothing itself; managers use the existing bonus/penalty on that stage |
| D2 | Dates of a fix | A — any dates, no date check |
| D3 | Stage must exist? | A — a fix can only be created when the stage task exists; if the stage task is deleted later, its fixes stay |
| D4 | Board look | A — bar in B's row, stage colour, striped, labelled "C1 LO · Fix"; A's bar unchanged |
| D5 | Creating a fix | A — create popover gets a "Fix" switch; stage picker lists only stages of that cut that have a task |
| D6 | Existing FI work type (Stillomatic 1+2, 2 tasks, 0 %) | C — leave them; owner cleans up |
| D7 | Cuts page | A — small read-only fix count on the stage cell |
| D8 | Emails, ICS, share page | A — fixes appear like normal tasks (digest, ICS, share page/PNG), with progress and links |
| D9 | Month of a bonus/penalty on a fixed stage | Fix's month — if that staff has a fix on the stage, use the end month of their latest fix; else the stage task's month (asked after review r1, Critic finding 3) |
