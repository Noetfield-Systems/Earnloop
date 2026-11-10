#!/usr/bin/env python3
"""Execute one scoped Company OS Earnloop WorkPacket on GitHub's own runner.
Source is pushed to a candidate PR only; no merge or deployment authorization.
"""
from __future__ import annotations
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import urllib.parse
import urllib.request
import urllib.error

API = "https://noetfield-agent-fabric-staging-staging.up.railway.app/api/internal/v1/company-delivery"
REPO = "Noetfield-Systems/Earnloop"
HEX = re.compile(r"^[0-9a-f]{32}$")
SHA = re.compile(r"^[a-f0-9]{40}$")
ROOT = Path(__file__).resolve().parents[1]


def shell(*args, timeout=40):
    result = subprocess.run(args, cwd=ROOT, capture_output=True, text=True, timeout=timeout)
    if result.returncode:
        raise RuntimeError("COMMAND_FAILED:" + args[0] + ":" +
                           re.sub(r"[\r\n]+", " ", (result.stderr or result.stdout)[-180:]))
    return result.stdout.strip()


def oidc():
    url = os.environ.get("ACTIONS_ID_TOKEN_REQUEST_URL", "")
    secret = os.environ.get("ACTIONS_ID_TOKEN_REQUEST_TOKEN", "")
    if not url.startswith("https://") or not secret:
        raise RuntimeError("GITHUB_OIDC_UNAVAILABLE")
    url += ("&" if "?" in url else "?") + "audience=noetfield-company-os-delivery"
    request = urllib.request.Request(url, headers={"Authorization": "Bearer " + secret})
    with urllib.request.urlopen(request, timeout=15) as stream:
        result = json.load(stream)
    token = result.get("value", "")
    if not isinstance(token, str) or len(token) < 200:
        raise RuntimeError("GITHUB_OIDC_INVALID")
    return token


def send(path, data, token):
    request = urllib.request.Request(API + path, method="POST",
        data=json.dumps(data, separators=(",", ":")).encode(),
        headers={"Authorization": "Bearer " + token,
                 "Content-Type": "application/json", "Accept": "application/json"})
    with urllib.request.urlopen(request, timeout=80) as stream:
        return json.load(stream)


def step_output(**values):
    if not os.environ.get("GITHUB_OUTPUT"):
        return
    with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf8") as out:
        for key, value in values.items():
            if not re.fullmatch(r"[a-z_]+", key) or "\n" in str(value):
                raise ValueError("INVALID_GITHUB_OUTPUT")
            out.write(f"{key}={value}\n")


def digest(text):
    return hashlib.sha256(text.encode()).hexdigest()


def write_candidate(plan, workstream, base_sha):
    suffix=workstream[:12]
    module=f"src/company-os/generated/feature_{suffix}.mjs"
    tests=f"tests/feature_{suffix}.test.mjs"
    if (plan.get("module_path")!=module or plan.get("test_path")!=tests or
        plan.get("source_sha")!=base_sha or plan.get("workstream_id")!=workstream or
        plan.get("repo")!=REPO):
        raise RuntimeError("MODEL_TARGET_OR_SOURCE_REFUSED")
    source, test = plan.get("module_code"), plan.get("test_code")
    if not isinstance(source,str) or not isinstance(test,str):
        raise RuntimeError("CODE_MISSING")
    if digest(source+"\n"+test)!=plan.get("combined_sha256"):
        raise RuntimeError("CODE_HASH_MISMATCH")
    for path, contents in ((module,source),(tests,test)):
        dest=ROOT/path
        if dest.exists() or dest.is_symlink():
            raise RuntimeError("NO_OVERWRITING_EXISTING_CODE")
        dest.parent.mkdir(parents=True,exist_ok=True)
        dest.write_text(contents,encoding="utf8")
    return module,tests


def main():
    token=oidc()
    if os.environ.get("GITHUB_EVENT_NAME")=="issues":
        event=json.loads(Path(os.environ["GITHUB_EVENT_PATH"]).read_text())
        issue=event.get("issue",{})
        if issue.get("title")!="SINA: Run Company OS Delivery" or (
            issue.get("user") or {}).get("login")!="kazemnezhadsina144-dot":
            step_output(state="IGNORED")
            print("IGNORED_UNTRUSTED_ISSUE")
            return
    claim=send("/claim",{},token)
    if claim.get("state")!="LEASED":
        step_output(state="IDLE")
        print(json.dumps({"state":claim.get("state"),"mutations":0}))
        return
    workstream=claim["workstream_id"]
    if not HEX.fullmatch(workstream) or claim.get("project_id")!="noetfield-earnloop":
        raise RuntimeError("INVALID_WORKPACKET_SCOPE")
    source_sha=shell("git","rev-parse","HEAD")
    if not SHA.fullmatch(source_sha):
        raise RuntimeError("INVALID_BASE_COMMIT")
    stage="CLAIMED"
    try:
        context="".join(
            f"\nFILE {path}\n"+(ROOT/path).read_text(encoding="utf8")[:3700]
            for path in ("src/company-os/engine.mjs","src/torox.mjs"))
        plan=send("/plan",{"workstream_id":workstream,
                "source_sha":source_sha,"context":context[:7800]},token)
        module,test=write_candidate(plan,workstream,source_sha)
        stage="WRITTEN"
        shell("node","--check",module,timeout=15)
        shell("node","--check",test,timeout=15)
        shell("npm","run","verify",timeout=200)
        stage="TESTED"
        branch="sina/company-delivery-"+workstream[:12]+"-"+os.environ["GITHUB_RUN_ID"]
        shell("git","config","user.name","noetfield-company-os[bot]")
        shell("git","config","user.email","41898282+github-actions[bot]@users.noreply.github.com")
        shell("git","switch","-c",branch)
        shell("git","add","--",module,test)
        shell("git","commit","-m","feat(earnloop): governed company-os workstream "+workstream[:12])
        head_sha=shell("git","rev-parse","HEAD")
        if not SHA.fullmatch(head_sha):
            raise RuntimeError("INVALID_COMMIT_SHA")
        shell("git","push","-u","origin",branch,timeout=90)
        stage="BRANCH_PUSHED"
        body=("Founder OS Workstream: "+workstream+"\n"+
              "Agent Fabric Task: "+claim["task_id"]+"\n"+
              "Project: noetfield-earnloop\n"+
              "Base SHA: "+source_sha+"\n"+
              "Candidate SHA: "+head_sha+"\n\n"+
              "Internal code candidate with npm run verify PASS. "+
              "No independent production result, payout, live users, "+
              "external action, automatic merge or deploy is claimed.")
        # GitHub Actions may have Contents:write but be barred by repo settings
        # from creating pull requests. Preserve the real source artifact and
        # independently test it instead of failing/dropping the entire mission.
        pr=None
        try:
            pr=shell("gh","pr","create","--base","main","--head",branch,
                     "--title","Company OS: Earnloop capability "+workstream[:12],
                     "--body",body,timeout=90)
        except RuntimeError as exc:
            if "GitHub Actions is not permitted to create or approve pull requests" not in str(exc):
                raise
            print("GITHUB_PR_POLICY_DENIED_BRANCH_AND_TESTS_RETAINED")
        if pr is not None and not re.fullmatch(r"https://github\.com/Noetfield-Systems/Earnloop/pull/[1-9][0-9]{0,8}",pr):
            raise RuntimeError("GITHUB_PR_NOT_CONFIRMED")
        delivery_state="PR_OPENED" if pr else "BRANCH_READY"
        send("/report",{"workstream_id":workstream,"status":delivery_state,
              "source_sha":source_sha,"commit_sha":head_sha,"pr_url":pr,
              "branch_ref":branch},token)
        evidence={"schema":"sina.company-delivery.builder-evidence.v1",
                  "workstream_id":workstream,"task_id":claim["task_id"],
                  "project_id":"noetfield-earnloop","repo":REPO,
                  "source_sha":source_sha,"head_sha":head_sha,"pr_url":pr,
                  "branch_ref":branch,
                  "module_path":module,"test_path":test,
                  "module_sha256":digest((ROOT/module).read_text()),
                  "test_sha256":digest((ROOT/test).read_text()),
                  "test_command":"npm run verify","test_result":"PASS",
                  "independently_verified":False,"deployed":False}
        (ROOT/"company-delivery-evidence.json").write_text(json.dumps(evidence,indent=2)+"\n")
        step_output(state="OPENED" if pr else "BRANCH_READY",head_sha=head_sha,workstream=workstream)
        print(json.dumps({"state":delivery_state,"pr_url":pr,"branch_ref":branch,"workstream_id":workstream,
                          "head_sha":head_sha,"independently_verified":False}))
    except Exception as exc:
        print(json.dumps({"state":"FAILED","stage":stage,"error_type":type(exc).__name__,
                          "workstream_id":workstream}))
        try:
            send("/report",{"workstream_id":workstream,"status":"FAILED",
                  "source_sha":source_sha},token)
        except Exception:
            print("REPORT_DEGRADED")
        raise


if __name__=="__main__":
    main()
