#!/usr/bin/env python3

import getpass
import sys


def main() -> int:
    import os
    os.environ["GARTH_TELEMETRY_ENABLED"] = "false"
    import garth

    email = input("Garmin email: ").strip()
    password = getpass.getpass("Garmin password: ")

    print("Authenticating...", end=" ", flush=True)
    try:
        garth.login(email, password)
    except Exception as e:
        print(f"\nAuthentication failed: {e}", file=sys.stderr)
        return 1

    secret = garth.client.dumps()
    print("OK\n")
    print("=" * 60)
    print("Your GARMIN_SECRET (copy this to GitHub Actions secrets):")
    print("=" * 60)
    print(secret)
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
