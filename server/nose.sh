#!/bin/bash

NOSE_ARGS=()

# Use > 1 to consume two arguments per pass in the loop (e.g. each
# argument has a corresponding value to go with it).
# Use > 0 to consume one or more arguments per pass in the loop (e.g.
# some arguments don't have a corresponding value to go with it such
# as in the --default example).
# note: if this is set to > 0 the /etc/hosts part is not recognized ( may be a bug )
while [[ $# > 0 ]]
do
key="$1"
case $key in
    -c|--coverage)
    COVERAGE_PREFIX="coverage run"
    ;;
    *)
    # unknown option
    NOSE_ARGS+=($key)
    ;;
esac
shift # past argument or value
done

# We use without-sandbox, so that we properly load all the modules/tests
cat app.yaml | sed 's/runtime: vm/runtime: python27/' > app-nose.yaml
# If our lib/ directory exists, manage it properly, otherwise assume the modules are all installed globally
if [ -d lib-local ]; then
	rm -rf lib-local/tests # this is pulled in via twilio, and messes with our excludes
	MODULES=$(find lib-local -maxdepth 1 | grep -v info | cut -f2- -d/ | sed 's/\.pyc?/\$/' | sed 's/^/\^/' | paste -s -d "|" -)
	EXCLUDE=--exclude="$MODULES"
else
	EXCLUDE=""
fi
PYTHONPATH=lib-local:lib-both $COVERAGE_PREFIX python -mnose --with-gae --gae-application=app-nose.yaml $EXCLUDE ${NOSE_ARGS[@]}
