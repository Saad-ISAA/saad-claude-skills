import json
import tempfile
import unittest
from pathlib import Path

import quality_ratchet as qr

EDN = """{:entries [
  {:name "place", :namespace "demo.Board", :complexity 3, :coverage 75.0, :crap 3.1}
  {:name "big", :namespace "demo.Board", :complexity 9, :coverage 10.0, :crap 31.5}
  {:name "skipped", :namespace "demo.Board", :complexity 2, :coverage nil, :crap nil}
]}"""


def run(tmp, edn, command, *extra, metric="crap"):
    crap = Path(tmp, "crap.edn")
    crap.write_text(edn)
    base = Path(tmp, "baseline.json")
    return qr.main([command, "--metric", metric, "--crap", str(crap), "--baseline", str(base), *extra]), base


class RatchetTest(unittest.TestCase):
    def test_parse_skips_unscored_entries(self):
        self.assertEqual(qr.parse_scores(EDN), {"demo.Board::place": 3.1, "demo.Board::big": 31.5})

    def test_complexity_metric_ignores_coverage(self):
        no_cov = EDN.replace(":crap 31.5", ":crap nil").replace(":coverage 10.0", ":coverage nil")
        with tempfile.TemporaryDirectory() as t:
            self.assertEqual(run(t, no_cov, "regen", "--init", "--limit", "9", metric="complexity")[0], 0)
            self.assertEqual(run(t, no_cov, "check", "--limit", "9", metric="complexity")[0], 0)
            more = no_cov.replace(":complexity 9", ":complexity 12")
            self.assertEqual(run(t, more, "check", "--limit", "9", metric="complexity")[0], 1)

    def test_partial_snapshot_only_judges_modules_it_covers(self):
        two = EDN.replace("]}", '  {:name "other", :namespace "demo.Other", :complexity 20, :coverage nil, :crap 99.0}\n]}')
        with tempfile.TemporaryDirectory() as t:
            run(t, two, "regen", "--init")
            self.assertEqual(run(t, EDN, "check")[0], 1)  # full run: demo.Other looks stale
            self.assertEqual(run(t, EDN, "check", "--partial")[0], 0)  # partial: not covered, not judged
            fixed = EDN.replace(":crap 31.5", ":crap 4.0")
            self.assertEqual(run(t, fixed, "check", "--partial")[0], 1)  # covered module: stale
            code, base = run(t, fixed, "regen", "--partial")
            self.assertEqual(code, 0)
            self.assertEqual(list(json.loads(base.read_text())["scores"]), ["demo.Other::other"])

    def test_init_then_check_passes(self):
        with tempfile.TemporaryDirectory() as t:
            self.assertEqual(run(t, EDN, "regen", "--init")[0], 0)
            self.assertEqual(run(t, EDN, "check")[0], 0)

    def test_check_without_baseline_fails_on_existing_debt(self):
        with tempfile.TemporaryDirectory() as t:
            self.assertEqual(run(t, EDN, "check")[0], 1)

    def test_worsened_function_fails(self):
        with tempfile.TemporaryDirectory() as t:
            run(t, EDN, "regen", "--init")
            worse = EDN.replace(":crap 31.5", ":crap 40.0")
            self.assertEqual(run(t, worse, "check")[0], 1)

    def test_new_function_over_limit_fails(self):
        with tempfile.TemporaryDirectory() as t:
            run(t, EDN, "regen", "--init")
            extra = EDN.replace("{:name \"skipped\"", '{:name "fresh", :namespace "demo.X", :crap 12.0}\n  {:name "skipped"')
            self.assertEqual(run(t, extra, "check")[0], 1)

    def test_stale_entry_fails_until_regen_shrinks(self):
        with tempfile.TemporaryDirectory() as t:
            run(t, EDN, "regen", "--init")
            fixed = EDN.replace(":crap 31.5", ":crap 4.0")
            self.assertEqual(run(t, fixed, "check")[0], 1)
            code, base = run(t, fixed, "regen")
            self.assertEqual(code, 0)
            self.assertEqual(json.loads(base.read_text())["scores"], {})
            self.assertEqual(run(t, fixed, "check")[0], 0)

    def test_regen_refuses_to_grow(self):
        with tempfile.TemporaryDirectory() as t:
            run(t, EDN, "regen", "--init")
            worse = EDN.replace(":crap 31.5", ":crap 40.0")
            code, base = run(t, worse, "regen")
            self.assertEqual(code, 1)
            self.assertEqual(json.loads(base.read_text())["scores"]["demo.Board::big"], 31.5)


if __name__ == "__main__":
    unittest.main()
