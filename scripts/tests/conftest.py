import sys
from pathlib import Path

# The pipeline modules import each other as top-level packages
# (`from processing.fit_parser import ...`), mirroring how sync.py runs them:
# it prepends scripts/ to sys.path. Do the same for the tests.
sys.path.insert(0, str(Path(__file__).parent.parent))
