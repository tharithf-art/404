"""Use a throw-away database for every test session (never touches data/ecoroute.db)."""
import os
import tempfile

_tmp = tempfile.mkdtemp()
os.environ["ECOROUTE_DB"] = os.path.join(_tmp, "test.db")
