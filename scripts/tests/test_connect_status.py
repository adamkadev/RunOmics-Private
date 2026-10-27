from datetime import date

from garmin.connect_status import read_connect_status, record_connect_status


def test_an_expiry_is_recorded_with_the_day_it_was_found(tmp_path):
    path = tmp_path / "connect_status.json"

    assert record_connect_status(expired=True, today=date(2026, 11, 3), path=path) is True

    assert read_connect_status(path) == {"state": "expired", "since": "2026-11-03"}


def test_the_nights_after_keep_the_first_day(tmp_path):
    path = tmp_path / "connect_status.json"
    record_connect_status(expired=True, today=date(2026, 11, 3), path=path)

    assert record_connect_status(expired=True, today=date(2026, 11, 4), path=path) is False

    assert read_connect_status(path)["since"] == "2026-11-03"


def test_a_working_token_after_an_expiry_marks_connect_active_again(tmp_path):
    path = tmp_path / "connect_status.json"
    record_connect_status(expired=True, today=date(2026, 11, 3), path=path)

    assert record_connect_status(expired=False, today=date(2026, 11, 9), path=path) is True

    assert read_connect_status(path) == {"state": "active", "since": "2026-11-09"}


def test_a_deployment_that_never_lost_connect_gets_no_file(tmp_path):
    path = tmp_path / "connect_status.json"

    assert record_connect_status(expired=False, path=path) is False

    assert not path.exists()


def test_an_unreadable_file_reads_as_no_status_and_is_rewritten_on_expiry(tmp_path):
    path = tmp_path / "connect_status.json"
    path.write_text('{"state": "exp')

    assert read_connect_status(path) == {}
    assert record_connect_status(expired=True, today=date(2026, 11, 3), path=path) is True
    assert read_connect_status(path)["state"] == "expired"
