import os
import socket
from pathlib import Path

import pytest
from conftest import NetworkBlocked

_REPOSITORY_DATA = Path(__file__).resolve().parents[2] / "data"


def test_paths_resolved_at_import_point_at_a_temporary_workspace():
    import sync
    from garmin import training_status

    session = Path(os.environ["RUNOMICS_DATA_DIR"]).resolve()

    assert session != _REPOSITORY_DATA
    assert sync._DATA_DIR == session
    assert training_status._STATUS_PATH.parent == session


def test_a_connection_is_refused_and_recorded(no_network):
    with pytest.raises(NetworkBlocked):
        socket.create_connection(("connectapi.garmin.example", 443))

    # Cleared only because this test tripped the guard on purpose.
    assert no_network == ["'connectapi.garmin.example'"]
    no_network.clear()


def test_a_curl_cffi_request_is_refused_and_recorded(no_network):
    from curl_cffi import requests as curl_requests

    with pytest.raises(NetworkBlocked):
        curl_requests.post("https://diauth.garmin.example/token")

    assert no_network == ["'https://diauth.garmin.example/token'"]
    no_network.clear()
