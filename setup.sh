#!/bin/bash

set -e

# Find latest version here: https://pypi.python.org/pypi/nose
NOSE_VERSION=nose-1.3.4
# Find latest version here: https://pypi.python.org/pypi/WebTest
WEBTEST_VERSION=WebTest-2.0.16

BASE_DIR=$(pwd)
mkdir -p download/

# NOSE-GAE
cd $BASE_DIR/download
sudo rm -rf NoseGAE
git clone https://github.com/Trii/NoseGAE.git
cd NoseGAE
sudo python setup.py install

# NOSE
cd $BASE_DIR/download
curl https://pypi.python.org/packages/source/n/nose/$NOSE_VERSION.tar.gz --output $NOSE_VERSION.tar.gz
tar xvzf $NOSE_VERSION.tar.gz
cd $NOSE_VERSION
sudo python setup.py install

# SPITFIRE
cd $BASE_DIR/download
svn checkout http://spitfire.googlecode.com/svn/trunk/ spitfire-read-only
cd spitfire-read-only
sudo python setup.py install
ln -sf download/spitfire-read-only/spitfire $BASE_DIR/

# APICLIENT
cd $BASE_DIR/download
hg clone https://code.google.com/p/google-api-python-client/ || echo "Already have hg client"
cd google-api-python-client
hg update
sudo python setup.py install
ln -sf download/google-api-python-client/apiclient $BASE_DIR/
ln -sf download/google-api-python-client/oauth2client $BASE_DIR/
ln -sf download/google-api-python-client/uritemplate $BASE_DIR/

# GDATA_PYTHON_CLIENT
cd $BASE_DIR/download
hg clone https://code.google.com/p/gdata-python-client/ || echo "Already have hg client"

cd gdata-python-client
hg update
sudo python setup.py install
ln -sf download/gdata-python-client/src/atom $BASE_DIR/
ln -sf download/gdata-python-client/src/gdata $BASE_DIR/

# GFLAGS
cd $BASE_DIR/download
svn checkout http://python-gflags.googlecode.com/svn/trunk/ python-gflags-read-only
cd python-gflags-read-only
sudo python setup.py install
ln -sf download/python-gflags-read-only/gflags.py $BASE_DIR/
ln -sf download/python-gflags-read-only/gflags_validators.py $BASE_DIR/

# HTTPLIB2
cd $BASE_DIR/download
hg clone https://code.google.com/p/httplib2/ || echo "Already have hg client"

cd httplib2
hg update
sudo python setup.py install
ln -sf download/httplib2/python2/httplib2 $BASE_DIR/

# MAPREDUCE
cd $BASE_DIR/download
git clone https://github.com/GoogleCloudPlatform/appengine-mapreduce.git
cd appengine-mapreduce
# no installation! just symlinking!
ln -sf download/appengine-mapreduce/python/src/mapreduce $BASE_DIR/

#GRAPHY (used by mapreduce)
cd $BASE_DIR/download
svn checkout http://graphy.googlecode.com/svn/trunk/ graphy-read-only
cd graphy-read-only
ln -sf download/graphy-read-only/graphy $BASE_DIR/

#SIMPLEJSON (used by mapreduce)
cd $BASE_DIR/download
git clone https://github.com/simplejson/simplejson.git
cd simplejson
python setup.py build
# no installation! just symlinking!
ln -sf download/simplejson/simplejson $BASE_DIR/

# WEBTEST
cd $BASE_DIR/download
curl https://pypi.python.org/packages/source/W/WebTest/$WEBTEST_VERSION.zip -o $WEBTEST_VERSION.zip
unzip -o $WEBTEST_VERSION
cd $WEBTEST_VERSION
sudo python setup.py install
# No symlink necessary here?
# ln -sf download/$WEBTEST_VERSION/webtest $BASE_DIR
