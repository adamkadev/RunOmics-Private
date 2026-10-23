import json

import pytest

from repository.history_file import (
    HistoryFileError,
    read_history,
    read_history_section,
    write_history,
)


class TestReadHistory:
    def test_absent_file_is_empty(self, tmp_path):
        # A fresh checkout has no history yet, and the first sync builds it.
        assert read_history(tmp_path / "nothing.json") == {}

    def test_reads_a_well_formed_file(self, tmp_path):
        path = tmp_path / "history.json"
        path.write_text(json.dumps({"days": {"2026-09-01": {"vo2max": 54}}}))

        assert read_history(path) == {"days": {"2026-09-01": {"vo2max": 54}}}

    def test_refuses_a_file_that_exists_but_does_not_parse(self, tmp_path):
        # Returning {} would make the caller rewrite the file with only the weeks Garmin still serves.
        path = tmp_path / "history.json"
        path.write_text('{"days": {"2026-09-01": {"vo2ma')

        with pytest.raises(HistoryFileError) as exc:
            read_history(path)
        assert "history.json" in str(exc.value)

    def test_refuses_a_file_holding_the_wrong_shape(self, tmp_path):
        path = tmp_path / "history.json"
        path.write_text("[1, 2, 3]")

        with pytest.raises(HistoryFileError):
            read_history(path)

    def test_section_of_an_absent_file_is_empty(self, tmp_path):
        assert read_history_section(tmp_path / "nothing.json", "days") == {}

    def test_section_missing_from_a_readable_file_is_empty(self, tmp_path):
        path = tmp_path / "history.json"
        path.write_text(json.dumps({"weeks": {}}))

        assert read_history_section(path, "days") == {}

    def test_section_of_the_wrong_type_is_an_error_not_an_empty_start(self, tmp_path):
        # Same rule as the whole file: the caller's next move is to rewrite it.
        path = tmp_path / "history.json"
        path.write_text(json.dumps({"days": ["not", "a", "map"]}))

        with pytest.raises(HistoryFileError):
            read_history_section(path, "days")

    def test_section_propagates_an_unreadable_file(self, tmp_path):
        path = tmp_path / "history.json"
        path.write_text("not json at all")

        with pytest.raises(HistoryFileError):
            read_history_section(path, "days")


class TestWriteHistory:
    def test_round_trips(self, tmp_path):
        path = tmp_path / "nested" / "history.json"
        write_history(path, {"days": {"2026-09-01": {"vo2max": 54}}})

        assert read_history(path) == {"days": {"2026-09-01": {"vo2max": 54}}}

    def test_leaves_no_temporary_file_behind(self, tmp_path):
        path = tmp_path / "history.json"
        write_history(path, {"days": {}})

        assert [p.name for p in tmp_path.iterdir()] == ["history.json"]

    def test_a_failed_write_leaves_the_previous_file_intact(self, tmp_path, monkeypatch):
        # The reason for tmp+rename: an interrupted write must not produce a truncated file.
        path = tmp_path / "history.json"
        write_history(path, {"days": {"2026-09-01": {"vo2max": 54}}})

        def explode(*_args, **_kwargs):
            raise OSError("no space left on device")

        monkeypatch.setattr("os.fsync", explode)
        with pytest.raises(OSError):
            write_history(path, {"days": {"2026-09-02": {"vo2max": 55}}})

        monkeypatch.undo()
        assert read_history(path) == {"days": {"2026-09-01": {"vo2max": 54}}}
        assert [p.name for p in tmp_path.iterdir()] == ["history.json"]

    def test_writes_utf8_unescaped(self, tmp_path):
        path = tmp_path / "history.json"
        write_history(path, {"feedback": "Récupération"})

        assert "Récupération" in path.read_text(encoding="utf-8")
