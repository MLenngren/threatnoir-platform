FROM alpine:3.21

ENV SUPERCRONIC_URL=https://github.com/aptible/supercronic/releases/download/v0.2.45/supercronic-linux-amd64 \
    SUPERCRONIC_SHA1SUM=e894b193bea75a5ee644e700c59e30eedc804cf7

RUN apk add --no-cache curl ca-certificates \
  && update-ca-certificates \
  && curl -fsSLo /usr/local/bin/supercronic "$SUPERCRONIC_URL" \
  && echo "${SUPERCRONIC_SHA1SUM}  /usr/local/bin/supercronic" | sha1sum -c - \
  && chmod +x /usr/local/bin/supercronic \
  && mkdir -p /etc/supercronic
COPY deploy/cron/crontab /etc/supercronic/crontab

CMD ["/usr/local/bin/supercronic", "/etc/supercronic/crontab"]
