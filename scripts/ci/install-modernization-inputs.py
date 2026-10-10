"""Fetch a pinned modernization input archive without changing legacy RC inputs."""
import os
import re
import runpy
from pathlib import Path
from urllib.parse import urlparse

url = os.environ.get('FORMICARIUM_MODERNIZATION_INPUT_URL', '')
parsed = urlparse(url)
if (parsed.scheme != 'https' or parsed.netloc != 'raw.githubusercontent.com'
        or parsed.query or parsed.fragment
        or not re.fullmatch(r'/aletheia-works/formicarium/[a-f0-9]{40}/[^?#]+', parsed.path)):
    raise SystemExit('fixed-commit public modernization input URL required')
os.environ['FORMICARIUM_CI_INPUT_URL'] = url
os.environ['FORMICARIUM_CI_INPUT_SHA256'] = os.environ.get('FORMICARIUM_MODERNIZATION_INPUT_SHA256', '')
runpy.run_path(str(Path(__file__).with_name('install-inputs.py')), run_name='__main__')
