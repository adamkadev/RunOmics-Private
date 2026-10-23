import json

from garmin.gear import ShoeGear, _map_gear, _normalize_brand, _split_combined_name, write_shoes_json


def _shoe(gear_id="abc123", brand="Nike", model="Vomero Plus", max_km=1000, retired=False):
    return ShoeGear(gear_id=gear_id, brand=brand, model=model, max_km=max_km, retired=retired, first_use_date=None)


class TestNormalizeBrand:
    def test_titlecases_all_lowercase_brand(self):
        assert _normalize_brand("adidas") == "Adidas"

    def test_titlecases_multi_word_lowercase_brand(self):
        assert _normalize_brand("new balance") == "New Balance"

    def test_leaves_already_capitalized_brand_untouched(self):
        assert _normalize_brand("Nike") == "Nike"

    def test_leaves_all_caps_brand_untouched(self):
        assert _normalize_brand("ASICS") == "ASICS"


class TestSplitCombinedName:
    def test_splits_on_first_space(self):
        assert _split_combined_name("Nike Pegasus 40") == ("Nike", "Pegasus 40")

    def test_single_word_returns_itself_for_both(self):
        assert _split_combined_name("Nike") == ("Nike", "Nike")


class TestMapGear:
    def test_converts_meters_to_rounded_km(self):
        item = {
            "uuid": "7b9054fa-affb-4305-a63a-c38d2e72909b",
            "brand": "adidas",
            "model": "Adizero EVO SL",
            "maxUsageDistanceMeters": 1000000.0,
        }
        shoe = _map_gear(item, retired=False)

        assert shoe.max_km == 1000
        assert shoe.brand == "Adidas"
        assert shoe.model == "Adizero EVO SL"
        assert shoe.retired is False

    def test_strips_dashes_from_uuid(self):
        item = {"uuid": "31632434-996e-484e-a1d4-1eb9c5b20b11", "brand": "Nike", "model": "Vomero Plus"}
        shoe = _map_gear(item, retired=True)

        assert shoe.gear_id == "31632434996e484ea1d41eb9c5b20b11"
        assert shoe.retired is True

    def test_falls_back_to_default_max_km_when_missing(self):
        item = {"uuid": "abc-123", "brand": "Nike", "model": "Pegasus 40"}
        shoe = _map_gear(item, retired=True)

        assert shoe.max_km == 1000

    def test_splits_combined_name_out_of_brand_when_model_is_empty(self):
        """Custom (non-catalog) gear can come back with `model` empty and the full name in `brand`."""
        item = {"uuid": "abc-123", "brand": "Nike Pegasus 40", "model": ""}
        shoe = _map_gear(item, retired=True)

        assert shoe.brand == "Nike"
        assert shoe.model == "Pegasus 40"

    def test_prefers_custom_make_model_over_brand_when_model_is_empty(self):
        item = {"uuid": "abc-123", "brand": "", "model": "", "customMakeModel": "Nike Pegasus 40"}
        shoe = _map_gear(item, retired=True)

        assert shoe.brand == "Nike"
        assert shoe.model == "Pegasus 40"


class TestWriteShoesJson:
    def test_writes_shoes_as_a_list_keyed_by_gear_id_fields(self, tmp_path):
        path = tmp_path / "shoes.json"

        changed = write_shoes_json([_shoe(gear_id="abc123")], path=path)

        assert changed is True
        payload = json.loads(path.read_text())
        assert payload == {
            "shoes": [
                {
                    "gearId": "abc123",
                    "brand": "Nike",
                    "model": "Vomero Plus",
                    "maxKm": 1000,
                    "retired": False,
                    "firstUseDate": None,
                }
            ]
        }

    def test_returns_false_when_content_unchanged(self, tmp_path):
        path = tmp_path / "shoes.json"
        shoes = [_shoe(gear_id="stable")]
        write_shoes_json(shoes, path=path)

        changed = write_shoes_json(shoes, path=path)

        assert changed is False

    def test_an_unreadable_file_is_rewritten_and_reported(self, tmp_path, capsys):
        # Garmin's list is the whole of it, so rewriting loses nothing.
        path = tmp_path / "shoes.json"
        path.write_text('{"shoes": [')

        assert write_shoes_json([_shoe(gear_id="abc123")], path=path) is True

        assert json.loads(path.read_text())["shoes"][0]["gearId"] == "abc123"
        assert f"{path} could not be read" in capsys.readouterr().out
