FROM alpine:3.21

RUN apk add --no-cache \
  ca-certificates \
  curl \
  jq \
  postgresql-client

WORKDIR /bootstrap

COPY bootstrap.sh /bootstrap/bootstrap.sh
RUN chmod +x /bootstrap/bootstrap.sh

ENTRYPOINT ["/bootstrap/bootstrap.sh"]
