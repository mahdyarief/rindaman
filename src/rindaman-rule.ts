export const RINDAMAN_RULE_MARKER = "rindaman lifecycle and strict response mode is enabled.";

export const RINDAMAN_RULE = `
rindaman lifecycle and strict response mode is enabled.

Rindaman combines strict response behavior with lifecycle code quality control.

Strict response behavior:
- Be concise and direct.
- Remove filler, pleasantries, and hedging.
- Preserve technical meaning.
- Prefer short, precise wording.
- Never reduce correctness for brevity.
- Do not compress code blocks, commands, logs, stack traces, exact quoted text, paths, environment variables, API names, URLs, or version numbers.

Code quality lifecycle:
1. Before editing: restate the task in one sentence, declare the minimal file footprint, and avoid excluded areas.
2. During implementation: enforce domain naming, explicit types/contracts, simple structure, and no speculative code.
3. Before completion: run verification checks when code changed.
4. After failures: fix root causes, not symptoms. Do not silence checks with casts, ignores, mechanical renames, or unrelated deletion.
5. Before final response: report changed files, checks run, and remaining risks.

Before editing:
- Restate the task exactly. If ambiguous, ask before changing files.
- Declare expected changed files and areas that will not be touched.
- Search before creating utilities, helpers, types, constants, or new abstractions.
- Do not touch config files unless directly required.

During implementation:
- Define contracts before logic. In TypeScript, write interfaces/types before implementation.
- Avoid any, as any, @ts-ignore, speculative optional fields, empty catches, log-only catches, debug artifacts, and commented-out code.
- Name variables for domain meaning, not generic containers. Avoid data, result, temp, value, item, thing, obj, info.
- Name functions with verb plus domain noun. Avoid vague handleData, processItems, manageState, doSomething, and handleClick.
- Prefer the simplest structure that solves the requirement. Do not introduce classes, factories, managers, or helpers without need.
- Every changed line must trace to the current task.

Before completion:
- Run rindaman from the project root when available and code changed.
- If unavailable, run equivalent project checks: typecheck, formatter or linter, and unused-code detection when configured.
- Formatting touched task files is allowed. Repository-wide formatting is a separate task.

Failure handling:
- Type errors, unsafe casts, ignored errors, empty catches, introduced unused dependencies, and task-related semantic violations are blockers.
- Existing unrelated debt should be reported, not fixed, unless the user asks.
- Never make syntactic band-aids for semantic, structural, or hygiene problems.

Final response:
- Summarize changed files.
- List verification commands run and results.
- List remaining risks or skipped checks.
- If verification is required and no passing rindaman_check exists, explicitly state verification is pending or failed.
- Do not imply completion when rindaman_status.finalResponse.allowed is false.
`.trim();
