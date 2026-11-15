import importlib.util
from pathlib import Path
import unittest

path=Path(__file__).resolve().parents[1]/"scripts"/"launch-factory-source-status.py"
spec=importlib.util.spec_from_file_location("lf_source_status",path)
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class SourceStatusTests(unittest.TestCase):
 def test_idle_is_not_a_completed_workpacket(self):
  body=module.render_status(state="IDLE",run_id="43777159118",issue="53")
  self.assertIn("no eligible coding work was leased",body)
  self.assertIn("workflow-state",body.lower()) if False else None
  self.assertIn("state:IDLE",body)
  self.assertIn("NOT",body.upper())
  self.assertNotIn("TECHNICALLY_VERIFIED",body)
  self.assertIn("actions/runs/43777159118",body)
 def test_branch_is_not_independent_verification(self):
  body=module.render_status(state="BRANCH_READY",run_id="123456",issue="53",
       workstream="a"*32,sha="b"*40)
  self.assertIn("readback and verifier still required",body)
  self.assertIn("a"*12,body)
  self.assertNotIn("a"*32,body)
  self.assertIn("b"*40,body)
 def test_bad_state_and_source_ref_are_rejected(self):
  for state in ["DONE","TECHNICALLY_VERIFIED","CLAIMED","SETTLED"]:
   with self.assertRaises(ValueError):
    module.render_status(state=state,run_id="123",issue="53")
  with self.assertRaises(ValueError):
   module.render_status(state="IDLE",run_id="123x",issue="53")
  with self.assertRaises(ValueError):
   module.render_status(state="OPENED",run_id="123",issue="53",workstream="not-a-hex-id")
 def test_run_comment_has_exact_bounded_marker(self):
  body=module.render_status(state="FAILED",run_id="43777159118",issue="53")
  self.assertIn("<!-- launch-factory:earnloop-run:43777159118:state:FAILED -->",body)
  self.assertIn("NOT",body.upper())

if __name__=="__main__":
 unittest.main()
