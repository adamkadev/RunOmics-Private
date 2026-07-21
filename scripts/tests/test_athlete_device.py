from garmin.athlete import extract_primary_device


def _device(device_id, **overrides):
    device = {
        "deviceId": device_id,
        "displayName": "Forerunner 255 Music",
        "productDisplayName": "Forerunner 255 Music",
        "currentFirmwareVersion": "28.05",
        "registeredDate": 1754323184000,
        "serialNumber": "7E3269026",
        "primary": True,
    }
    device.update(overrides)
    return device


def _payload(*devices, primary_id=None):
    return {
        "PrimaryTrainingDevice": {"deviceId": primary_id},
        "RegisteredDevices": list(devices),
    }


def test_extracts_the_primary_training_device():
    info = extract_primary_device(_payload(_device(3604810488), primary_id=3604810488))

    assert info == {
        "deviceId": 3604810488,
        "deviceName": "Forerunner 255 Music",
        "deviceFirmware": "28.05",
        "deviceSince": "2025-08-04",
    }


def test_never_keeps_the_serial_number():
    info = extract_primary_device(_payload(_device(1), primary_id=1))

    assert "serialNumber" not in info
    assert "7E3269026" not in str(info)


def test_picks_the_primary_device_among_several():
    payload = _payload(
        _device(1, displayName="Edge 530", primary=False),
        _device(2, displayName="Forerunner 255 Music"),
        primary_id=2,
    )

    assert extract_primary_device(payload)["deviceName"] == "Forerunner 255 Music"


def test_falls_back_to_the_flagged_primary_when_the_id_is_unknown():
    payload = _payload(
        _device(1, displayName="Edge 530", primary=False),
        _device(2, displayName="Forerunner 255 Music"),
        primary_id=None,
    )

    assert extract_primary_device(payload)["deviceName"] == "Forerunner 255 Music"


def test_returns_nothing_without_registered_devices():
    assert extract_primary_device({"RegisteredDevices": []}) == {}
    assert extract_primary_device({}) == {}


def test_tolerates_partial_device_records():
    payload = _payload({"deviceId": 7, "productDisplayName": "Venu 3"}, primary_id=7)

    assert extract_primary_device(payload) == {"deviceId": 7, "deviceName": "Venu 3"}
