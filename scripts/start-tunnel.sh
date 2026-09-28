#!/bin/sh
set -eu

# Use TCP transport to avoid QUIC/UDP idle timeouts on the local network.
exec cloudflared tunnel --protocol http2 --edge-ip-version 4 --url http://localhost:5042
