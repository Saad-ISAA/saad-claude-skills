# temper gate tools

crapper, dryer and mutator are by Robert C. Martin ("Uncle Bob") and are released under the
0BSD license: <https://github.com/unclebob/crapper>, <https://github.com/unclebob/dryer>,
<https://github.com/unclebob/mutator>. temper runs them; it does not bundle or modify them.

Three command-line tools, all Python, all handling Python and TypeScript (also Go, Java,
Rust, Clojure). Each detects the language per file and creates its own `.venv` on first run.

Install once, as siblings (mutator looks for `../crapper`):

```bash
mkdir -p ~/.local/share/temper && cd ~/.local/share/temper
for r in crapper dryer mutator; do git clone https://github.com/unclebob/$r.git; done
```

Run from the project root, on changed files first:

```bash
A=~/.local/share/temper

$A/crapper/crapper --no-coverage --changed     # fast: complexity only, no tests run
$A/crapper/crapper --changed --threshold 10   # deeper: needs coverage; exit 2 if any CRAP > 10
$A/crapper/crapper --no-coverage src/x.py     # complexity only, no test run

$A/dryer/dryer --changed --threshold 0.8      # duplicate candidates, closest first

$A/mutator/mutator --scan path/to/file.py     # list mutation sites, run nothing
$A/mutator/mutator path/to/file.py            # run mutants (slow); exit 3 = survivors
$A/mutator/mutator --test-command "pytest -q tests/test_x.py" path/to/file.py
```

Each writes a snapshot to `.metrics/` in the project. Add `.metrics/` and `target/` to the
project's `.gitignore` rather than committing them.

## Cautions

- **First run needs network.** The tools use `tree-sitter-language-pack`, which downloads each
  language's grammar the first time it is used (python, typescript, ...). Inside a network-
  restricted sandbox this fails with `DownloadError ... timeout`; warm the cache once from a
  normal shell: `~/.local/share/temper/crapper/.venv/bin/python -c "import tree_sitter_language_pack as t; t.download(['python','typescript','tsx','javascript'])"`.
- **crapper uses pytest only if the project is configured for it** (`pytest.ini`, `pyproject.toml`
  with `[tool.pytest...]`, or similar). Otherwise it falls back to `unittest`, finds no tests and
  reports 0% coverage. Run it from a venv that already has `pytest` and `coverage` so it does
  not install them into another interpreter.
- The launchers build their venv with whatever `python3` resolves to; check
  `~/.local/share/temper/*/.venv/bin/python --version` is a released Python (3.11 to 3.13).

- crapper and mutator **run the project's tests** to get coverage. In agent-os that means the
  Postgres test stack must be up (`docker compose -f docker-compose.test.yml up -d`); never
  point them at the app's own database.
- crapper installs `coverage`/`pytest` into the project's interpreter, or `@vitest/coverage-v8`
  into `node_modules`, when missing. Use `--no-coverage` or `--use-existing-coverage` to avoid that.
- Skips `test`, `spec`, `vendor`, `node_modules`, `target` directories by default.
- Not installed = report **not run**, never passed.
