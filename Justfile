tag := "catdevnull/busquebusqued:latest"
server := "why-so"

deploy:
  docker build -t {{tag}} --platform linux/amd64 .
  docker-pussh {{tag}} {{server}}
  just deploy-without-building

deploy-without-building:
  uncloud deploy --no-build --recreate
