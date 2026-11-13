#!/usr/bin/env python3
"""Release one *independently verified* and strictly scoped, generated code candidate.

This is an intentionally narrow fallback for an own-organization GitHub Actions
token that may PUSH contents but cannot CREATE a pull request under repository
settings. It NEVER overrides branch protection and never merges arbitrary LLM
changes, changes financial code, or asserts external/commercial success.

Source of authority is a fresh verified Fabric/isolated verifier readback,
the author's explicit autopublish authorization for this generated-only lane,
and GitHub's own branch policy. Any mismatch leaves the candidate on its own
branch and records an exact blocker.
"""
from __future__ import annotations
import json
import os
from pathlib import Path
import re
import subprocess
import urllib.request
from importlib.util import module_from_spec, spec_from_file_location

ROOT=Path(__file__).resolve().parents[1]
REPO="Noetfield-Systems/Earnloop"
HEX32=re.compile(r"^[0-9a-f]{32}$")
HEX40=re.compile(r"^[0-9a-f]{40}$")
BRANCH=re.compile(r"^sina/company-delivery-([0-9a-f]{12})-([0-9]{5,16})$")

def shell(*args,timeout=180):
    p=subprocess.run(args,cwd=ROOT,capture_output=True,text=True,timeout=timeout)
    if p.returncode:
        raise RuntimeError("GIT_OR_TEST_REJECTED:"+str(args[0])+":"+(
            (p.stderr or p.stdout)[-300:].replace("\n"," ")))
    return p.stdout.strip()

def check_claim(evidence, receipt, repo):
    if repo!=REPO or not isinstance(evidence,dict) or not isinstance(receipt,dict):
        raise ValueError("INVALID_REPOSITORY_OR_CLAIM")
    wid=evidence.get("workstream_id")
    head=evidence.get("head_sha")
    base=evidence.get("source_sha")
    branch=evidence.get("branch_ref")
    if (not isinstance(wid,str) or not HEX32.fullmatch(wid)
            or not isinstance(head,str) or not HEX40.fullmatch(head)
            or not isinstance(base,str) or not HEX40.fullmatch(base)
            or not isinstance(branch,str) or not BRANCH.fullmatch(branch)
            or BRANCH.fullmatch(branch).group(1)!=wid[:12]
            or head==base or evidence.get("repo")!=REPO
            or evidence.get("project_id")!="noetfield-earnloop"
            or evidence.get("test_command")!="npm run verify"
            or evidence.get("test_result")!="PASS"
            or not isinstance(evidence.get("task_id"),str)
            or evidence.get("pr_url") is not None):
        raise ValueError("UNAUTHORIZED_OR_NON_FALLBACK_CANDIDATE")
    expected={f"src/company-os/generated/feature_{wid[:12]}.mjs",
              f"tests/feature_{wid[:12]}.test.mjs"}
    found={evidence.get("module_path"),evidence.get("test_path")}
    if expected!=found:
        raise ValueError("UNEXPECTED_SOURCE_PATHS")
    if not all(isinstance(evidence.get(k),str) and re.fullmatch(r"[a-f0-9]{64}",evidence[k])
               for k in ("module_sha256","test_sha256")):
        raise ValueError("SOURCE_HASH_MISSING")
    payload=receipt.get("payload")
    sig=receipt.get("signature")
    if (not isinstance(payload,dict) or not isinstance(sig,str)
            or len(sig)<50 or payload.get("schema")!="sina.company-delivery.verification.v1"
            or payload.get("outcome")!="TECHNICALLY_VERIFIED"
            or payload.get("repo")!=REPO or payload.get("project_id")!="noetfield-earnloop"
            or payload.get("workstream_id")!=wid
            or payload.get("head_sha")!=head
            or payload.get("source_sha")!=base
            or payload.get("production_deployed") is not False
            or payload.get("commercially_verified") is not False):
        raise ValueError("INDEPENDENT_RECEIPT_MISMATCH")
    # The actual Ed25519 signature is checked again by the isolated Fabric
    # verification endpoint under GitHub-issued OIDC before any git push.
    return expected

def reverify_receipt(receipt):
    spec=spec_from_file_location("readback",ROOT/"scripts/company-os-readback.py")
    module=module_from_spec(spec);spec.loader.exec_module(module)
    token=module.authorize()
    request=urllib.request.Request(
        module.API+"/verify",method="POST",
        data=json.dumps(receipt,separators=(",",":")).encode(),
        headers={"Authorization":"Bearer "+token,"Content-Type":"application/json"})
    with urllib.request.urlopen(request,timeout=40) as stream:
        result=json.load(stream)
    if (result.get("state")!="TECHNICALLY_VERIFIED"
            or result.get("independently_verified") is not True
            or result.get("production_deployed") is not False
            or result.get("commercially_verified") is not False):
        raise ValueError("FRESH_VERIFIER_READBACK_REJECTED")

def main():
    evidence=json.loads(Path(os.environ["SINA_EVIDENCE_FILE"]).read_text())
    receipt=json.loads(Path(os.environ["SINA_RECEIPT_FILE"]).read_text())
    allowed=check_claim(evidence,receipt,os.environ.get("GITHUB_REPOSITORY"))
    branch=evidence["branch_ref"]
    head=evidence["head_sha"]
    base=evidence["source_sha"]
    shell("git","fetch","origin","main",timeout=90)
    mainsha=shell("git","rev-parse","refs/remotes/origin/main")
    if mainsha!=base:
        print(json.dumps({"state":"RELEASE_DEFERRED_MAIN_MOVED","expected":base,
                          "observed":mainsha,"candidate":head}))
        return
    shell("git","fetch","origin","refs/heads/"+branch,timeout=90)
    if shell("git","rev-parse","FETCH_HEAD")!=head:
        raise ValueError("CANDIDATE_SOURCE_CHANGED")
    if shell("git","rev-list","--count",base+".."+head)!="1":
        raise ValueError("MULTI_COMMIT_CANDIDATE_REFUSED")
    changed=set(shell("git","diff","--name-only",base,head).splitlines())
    if changed!=allowed:
        raise ValueError("DIFF_NOT_JUST_GENERATED_CODE_AND_TESTS")
    for name in allowed:
        if shell("git","cat-file","-t",head+":"+name)!="blob":
            raise ValueError("UNEXPECTED_GIT_OBJECT")
    shell("git","checkout","--detach",head)
    shell("git","diff","--check",base,head)
    shell("npm","run","verify",timeout=450)
    reverify_receipt(receipt)
    # Normal fast-forward only: no force, no admin bypass, no overwrite or
    # special GitHub tokens. Branch protection continues to control the push.
    try:
        shell("git","push","origin",head+":refs/heads/main",timeout=90)
    except RuntimeError:
        print(json.dumps({"state":"RELEASE_DEFERRED_BY_GITHUB_POLICY",
                          "verified_head":head,"reason":"Protected main or token lacks permission"}))
        return
    observed=shell("git","ls-remote","origin","refs/heads/main").split()[0]
    if observed!=head:
        raise RuntimeError("REMOTE_MAIN_READBACK_MISMATCH")
    print(json.dumps({"state":"VERIFIED_GENERATED_CODE_RELEASED","main_sha":head,
        "scope":"new_generated_module_and_test_only",
        "production_deployed":"NOT_YET_VERIFIED",
        "commercial_result":"NOT_VERIFIED"},sort_keys=True))

if __name__=="__main__":main()
