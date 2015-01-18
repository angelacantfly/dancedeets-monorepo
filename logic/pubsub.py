# -*-*- encoding: utf-8 -*-*-

import urlparse
import oauth2 as oauth

from google.appengine.ext import ndb
from twitter import Twitter
from twitter import OAuth

import keys
from util import urls

consumer_key = 'xzpiBnUCGqTWSqTgmE6XtLDpw'
consumer_secret = keys.get("twitter_consumer_secret") 

def format_post(db_event, fb_event):
    url = urls.fb_event_url(fb_event['info']['id'])
    title = fb_event['info']['name']
    city = db_event.actual_city_name

    # twitter length is 22, so I use 23 to give buffer.
    # TODO(lambert): fetch help/configuration daily to find the current value
    # as described on https://dev.twitter.com/overview/t.co
    url_length = 23
    title_length = 140 - url_length - len(city) - len(u": … ")

    final_title = title[0:title_length]
    if final_title != title:
        final_title += u'…'
    return u"%s: %s %s" % (city, final_title, url)

def twitter_post(db_event, fb_event):
    status = format_post(db_event, fb_event)
    token_key = keys.get("twitter_access_token_secret")

    t = Twitter(
        auth=OAuth("2982386308-SaQrXs3Va0ZpjXDe5hgJ9N52x3yfq8ZsO2VXvLB", token_key, consumer_key, consumer_secret))
    t.statuses.update(
        status=status)

def authed_twitter_post(auth_token, db_event, fb_event):
    status = format_post(db_event, fb_event)

    t = Twitter(
        auth=OAuth(auth_token.oauth_token, auth_token.oauth_token_secret, consumer_key, consumer_secret))
    t.statuses.update(
        status=status)

request_token_url = 'https://twitter.com/oauth/request_token'
access_token_url = 'https://twitter.com/oauth/access_token'
authorize_url = 'https://twitter.com/oauth/authorize'

APP_TWITTER = 'APP_TWITTER'
APP_INSTAGRAM = 'APP_INSTAGRAM'
#...fb?
#...tumblr?

class AuthToken(ndb.Model):
    user_id = ndb.StringProperty()
    token_nickname = ndb.StringProperty()
    application = ndb.StringProperty()
    temp_oauth_token = ndb.StringProperty()
    temp_oauth_token_secret = ndb.StringProperty()
    valid_token = ndb.BooleanProperty()
    oauth_token = ndb.StringProperty()
    oauth_token_secret = ndb.StringProperty()
    #search criteria? location? radius? search terms?
    #post on event find? post x hours before event? multiple values?

def twitter_oauth1(user_id, token_nickname):
    consumer = oauth.Consumer(consumer_key, consumer_secret)
    client = oauth.Client(consumer)

    # Step 1: Get a request token. This is a temporary token that is used for 
    # having the user authorize an access token and to sign the request to obtain 
    # said access token.

    resp, content = client.request(request_token_url, "GET")
    print resp, content
    if resp['status'] != '200':
        raise Exception("Invalid response %s." % resp['status'])

    request_token = dict(urlparse.parse_qsl(content))

    auth_token = AuthToken(user_id=str(user_id), token_nickname=token_nickname, application=APP_TWITTER,
        valid_token=False, temp_oauth_token=request_token['oauth_token'], temp_oauth_token_secret=request_token['oauth_token_secret'])
    auth_token.put()

    #print "Request Token:"
    #print "    - oauth_token        = %s" % request_token['oauth_token']
    #print "    - oauth_token_secret = %s" % request_token['oauth_token_secret']
    #print 

    # Step 2: Redirect to the provider. Since this is a CLI script we do not 
    # redirect. In a web application you would redirect the user to the URL
    # below.

    #print "Go to the following link in your browser:"
    return "%s?oauth_token=%s" % (authorize_url, request_token['oauth_token'])

#user comes to:
#/sign-in-with-twitter/?
#        oauth_token=NPcudxy0yU5T3tBzho7iCotZ3cnetKwcTIRlX0iwRl0&
#        oauth_verifier=uw7NjWHT6OJ1MpJOXsHfNxoAhPKpgI8BlYDhxEjIBY

def twitter_oauth2(oauth_token, oauth_verifier):
    auth_tokens = AuthToken.query(AuthToken.temp_oauth_token==oauth_token, AuthToken.application==APP_TWITTER).fetch(1)
    if not auth_tokens:
        return None
    auth_token = auth_tokens[0]
    # Step 3: Once the consumer has redirected the user back to the oauth_callback
    # URL you can request the access token the user has approved. You use the 
    # request token to sign this request. After this is done you throw away the
    # request token and use the access token returned. You should store this 
    # access token somewhere safe, like a database, for future use.
    token = oauth.Token(oauth_token,
        auth_token.temp_oauth_token_secret)
    token.set_verifier(oauth_verifier)
    consumer = oauth.Consumer(consumer_key, consumer_secret)
    client = oauth.Client(consumer, token)

    resp, content = client.request(access_token_url, "POST")
    access_token = dict(urlparse.parse_qsl(content))
    auth_token.oauth_token = access_token['oauth_token']
    auth_token.oauth_token_secret = access_token['oauth_token_secret']
    auth_token.put()
    return auth_token

