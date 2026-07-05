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
        print(
            "\nNote: garth is deprecated and Garmin has been breaking its login\n"
            "flow (the OAuth token it produces keeps working for ~1 year and\n"
            "sync.py only refreshes that token, so day-to-day syncs are not\n"
            "affected - only this initial login is fragile). If login fails:\n"
            "  - try again from a residential IP (Cloudflare blocks datacenter IPs),\n"
            "  - see https://github.com/matin/garth/discussions/222 for current\n"
            "    workarounds (e.g. overriding the User-Agent) and alternatives.\n",
            file=sys.stderr,
        )
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
