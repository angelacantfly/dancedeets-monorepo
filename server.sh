./killserver.sh
cat app.yaml | sed 's/runtime: custom/runtime: python27/' | sed 's/GAE_USE_SOCKETS_HTTPLIB/x_disabled_GAE_USE_SOCKETS_HTTPLIB/' > app-devserver.yaml
dev_appserver.py app-devserver.yaml --storage_path ~/Projects/dancedeets-storage/ "$@"
