import json, sys
from pathlib import Path
from limiter import run_one
ROOT = Path(__file__).resolve().parent
if (ROOT/'formal.jsonl').exists(): raise RuntimeError('Refuse to overwrite evidence')
config = json.loads((ROOT/'formal-config.json').read_text())
cases = json.loads((ROOT/'measured-cases.json').read_text())
order = 0
for rep in range(config['repetitions']):
    for ci, case in enumerate(cases if rep % 2 == 0 else list(reversed(cases))):
        variants = config['variants']
        shift = (ci + rep) % len(variants)
        variants = variants[shift:] + variants[:shift]
        if rep % 2: variants = list(reversed(variants))
        for variant in variants:
            order += 1
            row = run_one(case, variant, config['wallLimitMs'], 'formal', rep + 1, order)
            if row['status'] in ['INVALID_SOLUTION', 'ERROR', 'MEMORY_LIMIT']:
                raise RuntimeError('BLOCKED: investigate correctness/runtime failure before expanding measurement: '+str(row))
