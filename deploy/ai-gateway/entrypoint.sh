#!/bin/sh
set -e
if [ -d /opt/claude/versions ]; then
  LATEST=$(ls -1v /opt/claude/versions 2>/dev/null | tail -n1)
  if [ -n "$LATEST" ] && [ -x "/opt/claude/versions/$LATEST" ]; then
    ln -sf "/opt/claude/versions/$LATEST" /usr/local/bin/claude
    echo "[entrypoint] linked claude → /opt/claude/versions/$LATEST"
  fi
fi
exec "$@"