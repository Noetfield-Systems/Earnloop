"""Truthful Github-owned execution status for the existing Earnloop Company OS runner.

Renders an issue comment for an authorized Founder-created issue. Does not
create a second task, modify the work lease, or claim independent verification.
"""
import json
import os
import re
import subprocess

ALLOWED = {"OPENED", "BRANCH_READY", "IDLE", "FAILED", "IGNORED"}
HEX = re.compile(r"^[a-f0-9]{32}$")
SHA = re.compile(r"^[a-f0-9]{40}$")


def render_status(*, state: str, run_id: str, issue: str, workstream: str = "", sha: str = "") -> str:
    if state not in ALLOWED or not run_id.isdecimal() or not issue.isdecimal():
        raise ValueError("invalid_source_runner_status")
    if workstream and not HEX.fullmatch(workstream):
        raise ValueError("invalid_internal_workstream_reference")
    if sha and not SHA.fullmatch(sha):
        raise ValueError("invalid_source_commit_reference")
    headline = {
        "OPENED": "Source candidate PR opened; runner readback and verifier still required",
        "BRANCH_READY": "Candidate branch prepared; downstream readback and verifier still required",
        "IDLE": "Runner admitted the trigger, but no eligible coding work was leased",
        "FAILED": "Candidate execution failed; inspect exact workflow diagnostics",
        "IGNORED": "Trigger ignored; no authorized work executed",
    }[state]
    url = f"https://github.com/Noetfield-Systems/Earnloop/actions/runs/{run_id}"
    return (
        f"<!-- launch-factory:earnloop-run:{run_id}:state:{state} -->\n"
        f"### Earnloop Company OS source runner — {headline}\n"
        f"- Workflow run: {url}\n"
        f"- GitHub candidate state: `{state}`\n"
        f"- Workstream: `{workstream[:12]}` (truncated)\n" if workstream else
        f"<!-- launch-factory:earnloop-run:{run_id}:state:{state} -->\n"
        f"### Earnloop Company OS source runner — {headline}\n"
        f"- Workflow run: {url}\n"
        f"- GitHub candidate state: `{state}`\n"
    ) + (
        f"- Candidate HEAD: `{sha}`\n" if sha else ""
    ) + (
        "- Source status is a GitHub runner observation, **not an independent verifier permit, "
        "user activation, payout or collected revenue**.\n"
        "- Existing Company OS, not Launch Factory, owns actual work leases and external authority.\n"
    )


def main() -> None:
    if os.environ.get("GITHUB_REPOSITORY") != "Noetfield-Systems/Earnloop":
        raise RuntimeError("wrong_github_repository")
    issue = os.environ["TRIGGER_ISSUE"]
    run_id = os.environ["GITHUB_RUN_ID"]
    state = os.environ.get("CANDIDATE_STATE") or "FAILED"
    body = render_status(state=state, issue=issue, run_id=run_id,
                         workstream=os.environ.get("CANDIDATE_WORKSTREAM", ""),
                         sha=os.environ.get("CANDIDATE_HEAD_SHA", ""))
    # Idempotent on reruns; GitHub provider comment is public evidence, not business success.
    r = subprocess.run(["gh", "api", f"repos/Noetfield-Systems/Earnloop/issues/{issue}/comments",
                        "--paginate", "-q", ".[].body"], capture_output=True, text=True, check=True)
    marker = f"<!-- launch-factory:earnloop-run:{run_id}:state:{state} -->"
    if marker in r.stdout:
        print(json.dumps({"state": state, "result": "ALREADY_COMMENTED", "run_id": run_id}))
        return
    subprocess.run(["gh", "issue", "comment", issue, "--repo", "Noetfield-Systems/Earnloop",
                    "--body", body], check=True)
    print(json.dumps({"state": state, "result": "SOURCE_STATUS_COMMENT_POSTED",
                      "run_id": run_id, "business_outcome_verified": False}))


if __name__ == "__main__":
    main()
