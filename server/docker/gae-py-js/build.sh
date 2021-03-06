set -euo pipefail
cd `dirname $0`
export NAME=gae-py-js
export LOCAL_IMAGE=mlambert/$NAME
export REMOTE_IMAGE=gcr.io/dancedeets-hrd/$NAME
docker build -t $LOCAL_IMAGE .
docker tag $LOCAL_IMAGE $REMOTE_IMAGE
gcloud docker -- push $REMOTE_IMAGE
