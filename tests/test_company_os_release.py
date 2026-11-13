"""Pure fail-closed acceptance for the governed generated-only release lane."""
import importlib.util
from pathlib import Path
import unittest

spec=importlib.util.spec_from_file_location(
    "release",Path(__file__).resolve().parents[1]/"scripts/company-os-release.py")
release=importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)

W="a"*32
BASE="1"*40
HEAD="2"*40
EVIDENCE={
    "workstream_id":W,"head_sha":HEAD,"source_sha":BASE,
    "branch_ref":f"sina/company-delivery-{W[:12]}-43366376343",
    "repo":release.REPO,"project_id":"noetfield-earnloop","task_id":"task_real_123",
    "test_command":"npm run verify","test_result":"PASS","pr_url":None,
    "module_path":f"src/company-os/generated/feature_{W[:12]}.mjs",
    "test_path":f"tests/feature_{W[:12]}.test.mjs",
    "module_sha256":"a"*64,"test_sha256":"b"*64,
}
RECEIPT={"signature":"c"*90,"payload":{
    "schema":"sina.company-delivery.verification.v1","outcome":"TECHNICALLY_VERIFIED",
    "repo":release.REPO,"project_id":"noetfield-earnloop",
    "workstream_id":W,"head_sha":HEAD,"source_sha":BASE,
    "production_deployed":False,"commercially_verified":False,
}}

class GeneratedReleasePolicyTest(unittest.TestCase):
    def valid(self,e=None,r=None,repo=None):
        return release.check_claim(e or dict(EVIDENCE),r or dict(RECEIPT),repo or release.REPO)

    def test_bounded_generated_file_allowlist(self):
        self.assertEqual(self.valid(),{
            f"src/company-os/generated/feature_{W[:12]}.mjs",
            f"tests/feature_{W[:12]}.test.mjs"})

    def test_requires_original_company_and_exact_workstream(self):
        for field,value in (("repo","Other/Repository"),("project_id","cairn"),
                            ("head_sha","9"*40),("source_sha","8"*40),
                            ("workstream_id","invalid"),("pr_url","https://github.com/org/r/pull/1"),
                            ("module_path","src/checkout.mjs"),("test_result","SKIPPED")):
            with self.subTest(field=field):
                changed=dict(EVIDENCE,**{field:value})
                with self.assertRaises(ValueError):self.valid(e=changed)
        with self.assertRaises(ValueError):
            self.valid(repo="Noetfield-Systems/SignalForge")

    def test_refuses_unsigned_or_fabricated_verifier(self):
        for field,value in (("outcome","UNKNOWN"),("head_sha","0"*40),
                            ("production_deployed",True),("commercially_verified",True),
                            ("repo","Noetfield-Systems/Cairn"),("project_id","other"),
                            ("source_sha","0"*40)):
            with self.subTest(field=field):
                claim={"signature":RECEIPT["signature"],
                       "payload":dict(RECEIPT["payload"],**{field:value})}
                with self.assertRaises(ValueError):self.valid(r=claim)
        with self.assertRaises(ValueError):
            self.valid(r={"signature":"bad","payload":RECEIPT["payload"]})

    def test_provenance_scope_cannot_cross_branch_or_contract(self):
        cases=[
            dict(branch_ref="sina/company-delivery-deadbeefdead-43366376343"),
            dict(branch_ref="main"),dict(test_command="true"),
            dict(head_sha=BASE),dict(module_sha256="invalid"),
        ]
        for changed in cases:
            with self.subTest(changed=changed):
                with self.assertRaises(ValueError):self.valid(e=dict(EVIDENCE,**changed))

if __name__=="__main__":unittest.main()
