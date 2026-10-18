"""検証専用入力archiveの全member、digest、秘密の既知形式を確認する。"""
import hashlib
import json
import re
import tarfile
from pathlib import Path, PurePosixPath

root = Path('/Users/mutoakio/Documents/formicarium')
base = root / '.artifacts/modernization-current-v1'
archive = base / 'modernization-inputs-v5.tar.gz'
manifest = json.loads((base / 'inputs-v5/manifest.json').read_text())
expected = {'manifest.json': (base / 'inputs-v5/manifest.json').read_bytes()}
pins = {'payload/' + row['path']: row for row in manifest['files']}
seen = set()
total = 0
findings = []
credential = re.compile(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{60,}|npm_[A-Za-z0-9]{36}')
with tarfile.open(archive, 'r:gz') as stream:
    for member in stream:
        path = PurePosixPath(member.name)
        if not member.isfile() or path.is_absolute() or '..' in path.parts or str(path) in seen:
            raise SystemExit('nonregular, unsafe or duplicate member')
        seen.add(str(path))
        data = stream.extractfile(member).read()
        total += len(data)
        if str(path) == 'manifest.json':
            if data != expected['manifest.json']:
                raise SystemExit('manifest differs')
        else:
            pin = pins.get(str(path))
            if not pin or len(data) != pin['bytes'] or hashlib.sha256(data).hexdigest() != pin['sha256']:
                raise SystemExit('payload differs: ' + str(path))
        if credential.search(data):
            findings.append(str(path))
if seen != set(pins) | {'manifest.json'} or findings:
    raise SystemExit('inventory or known credential pattern refused: ' + repr(findings))
result = {'archiveSha256': hashlib.sha256(archive.read_bytes()).hexdigest(), 'members': len(seen), 'expandedBytes': total, 'knownCredentialPatterns': 0, 'sourceCommit': manifest['sourceCommit'], 'limits': '既知形式の検出のみ。全秘密検出や実CI成功を保証しない。'}
Path(__file__).with_name('archive-check.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))
print(json.dumps(result, ensure_ascii=False))
