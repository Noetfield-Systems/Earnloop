#!/usr/bin/env python3
"""Close a tested candidate through the existing isolated verifier and Fabric queue."""
import json
import os
from pathlib import Path
import urllib.request
from importlib.util import spec_from_file_location, module_from_spec
spec=spec_from_file_location('readback',Path(__file__).with_name('company-os-readback.py'))
module=module_from_spec(spec); spec.loader.exec_module(module)
VERIFIER='https://sina-selfbuild-verifier-staging-staging.up.railway.app/company-delivery/verify'
def post(url,body,token):
    req=urllib.request.Request(url,data=json.dumps(body).encode(),headers={
        'Content-Type':'application/json','Authorization':'Bearer '+token},method='POST')
    with urllib.request.urlopen(req,timeout=90) as response:
        return json.load(response)
def main():
    evidence=json.loads(Path(os.environ['SINA_EVIDENCE_FILE']).read_text())
    token=module.authorize()
    receipt=post(VERIFIER,evidence,token)
    result=post(module.API+'/verify',receipt,token)
    if result.get('state')!='TECHNICALLY_VERIFIED': raise RuntimeError('VERIFICATION_NOT_RECORDED')
    Path('company-delivery-verification.json').write_text(json.dumps(receipt,sort_keys=True,indent=2))
    print(json.dumps(result,sort_keys=True))
if __name__=='__main__': main()
