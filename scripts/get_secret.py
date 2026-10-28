#!/usr/bin/env python3
"""Mint GARMIN_SECRET: one Garmin Connect sign-in, with the MFA code if the account asks for one.

Standard output carries the secret and nothing else; every prompt and message goes to standard error.
"""

from __future__ import annotations

import getpass
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))


def _say(message: str) -> None:
    print(message, file=sys.stderr, flush=True)


def _ask(prompt: str) -> str:
    sys.stderr.write(prompt)
    sys.stderr.flush()
    return sys.stdin.readline().strip()


def main() -> int:
    from garminconnect import Garmin, GarminConnectAuthenticationError, GarminConnectTooManyRequestsError

    from garmin.auth import encode_secret, jwt_expiry

    # Garmin.login() would read a token store from here instead of signing in.
    os.environ.pop("GARMINTOKENS", None)

    email = _ask("Garmin email: ")
    password = getpass.getpass("Garmin password: ", stream=sys.stderr)
    if not email or not password:
        _say("An email and a password are both needed; nothing was sent to Garmin.")
        return 1

    garmin = Garmin(email, password, prompt_mfa=lambda: _ask("MFA code from Garmin: "))
    _say("Signing in. Garmin paces sign-ins, so this can take a minute...")
    try:
        garmin.login()
    except GarminConnectTooManyRequestsError:
        _say(
            "\nGarmin is rate-limiting sign-ins (429). Every attempt restarts the wait: leave it an hour or more, "
            "then try once, from a home connection rather than a VPN or a datacenter."
        )
        return 1
    except GarminConnectAuthenticationError as exc:
        _say(f"\nSign-in refused: {exc}")
        return 1
    except Exception as exc:
        _say(f"\nSign-in failed: {type(exc).__name__}: {exc}")
        return 1

    client = garmin.client
    if not client.di_token:
        _say(
            "\nGarmin signed in through its web session cookie only, which lasts hours and cannot be stored. "
            "No secret was produced; try again later."
        )
        return 1

    expires = jwt_expiry(client.di_token)
    _say("\nSigned in.")
    if expires is not None:
        _say(f"  access token expires : {datetime.fromtimestamp(expires, tz=timezone.utc).isoformat(timespec='seconds')}")
    refresh = "present" if client.di_refresh_token else "MISSING: the secret stops with the access token"
    _say(f"  refresh token        : {refresh}")
    _say("\nGARMIN_SECRET is the one line below, on standard output. Put it in this profile's GitHub Environment")
    _say("and in its .env.<profile>.local; do not paste it anywhere else.\n")
    print(encode_secret(client.dumps()), flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
