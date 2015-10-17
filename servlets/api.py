import datetime
import json
import logging
import re
import traceback
import urllib

from google.appengine.api import taskqueue

import app
import base_servlet
import fb_api
from events import eventdata
from loc import formatting
from loc import gmaps_api
from loc import math
from search import search
from search import search_base
from users import user_creation
from users import users

DATETIME_FORMAT = "%Y-%m-%dT%H:%M:%SZ"


class ApiHandler(base_servlet.BareBaseRequestHandler):
    requires_auth = False
    supports_auth = False

    def requires_login(self):
        return False

    def write_json_error(self, error_result):
        return self._write_json_data(error_result)

    def write_json_success(self, results=None):
        if results is None:
            results = {'success': True}
        return self._write_json_data(results)

    def _write_json_data(self, json_data):
        callback = self.request.get('callback')
        if callback:
            self.response.headers['Content-Type'] = 'application/javascript; charset=utf-8'
        else:
            self.response.headers['Content-Type'] = 'application/json; charset=utf-8'

        if callback:
            self.response.out.write('%s(' % callback)
        self.response.out.write(json.dumps(json_data))
        if callback:
            self.response.out.write(')')

    def handle_error_response(self, errors):
        self.write_json_error({'errors': errors})
        return True

    def initialize(self, request, response):
        super(ApiHandler, self).initialize(request, response)

        self.fbl = fb_api.FBLookup(None, None)

        if self.request.body:
            logging.info("Request body: %r", self.request.body)
            escaped_body = urllib.unquote_plus(self.request.body.strip('='))
            self.json_body = json.loads(escaped_body)
            logging.info("json_request: %r", self.json_body)
        else:
            self.json_body = None

        if self.requires_auth or self.supports_auth:
            if self.json_body.get('access_token'):
                self.fbl = fb_api.FBLookup(None, self.json_body.get('access_token'))
                self.fbl.make_passthrough()
                self.fb_user = self.fbl.get(fb_api.LookupUser, 'me')
                self.fb_uid = self.fb_user['profile']['id']
                logging.info("Access token for user ID %s", self.fb_uid)
            elif self.requires_auth:
                self.add_error("Needs access_token parameter")


@app.route('/api/v(\d+).(\d+)/search')
class SearchHandler(ApiHandler):

    def _get_title(self, location, keywords):
        if location:
            if keywords:
                return "Events near %s containing %s" % (location, keywords)
            else:
                return "Events near %s" % location
        else:
            if keywords:
                return "Events containing %s" % keywords
            else:
                return "Events"

    def get(self, major_version, minor_version):
        data = {
            'location': self.request.get('location'),
            'keywords': self.request.get('keywords'),
        }
        # If it's 1.0 clients, or web clients, then grab all data
        if major_version == '1' and minor_version == '0':
            time_period = search_base.TIME_UPCOMING
        else:
            time_period = self.request.get('time_period')
        data['time_period'] = time_period
        form = search_base.SearchForm(data=data)

        if not form.validate():
            for field, errors in form.errors.items():
                for error in errors:
                    self.add_error(u"%s error: %s" % (
                        getattr(form, field).label.text,
                        error
                    ))

        if not form.location.data:
            city_name = None
            southwest = None
            northeast = None
            if not form.keywords.data:
                if major_version == "1" and minor_version == "0":
                    self.write_json_success({'results': []})
                    return
                else:
                    self.add_error('Please enter a location or keywords')                
        else:
            geocode = gmaps_api.get_geocode(address=form.location.data)
            if geocode:
                southwest, northeast = math.expand_bounds(geocode.latlng_bounds(), form.distance_in_km())
                city_name = formatting.format_geocode(geocode)
                # This will fail on a bad location, so let's verify the location is geocodable above first.
            else:
                if major_version == "1" and minor_version == "0":
                    self.write_json_success({'results': []})
                    return
                else:
                    self.add_error('Could not geocode location')

        self.errors_are_fatal()

        search_query = search.SearchQuery.create_from_form(form)

        # TODO(lambert): Increase the size limit when our clients can handle it. And improve our result sorting to return the 'best' results.
        search_query.limit = 500

        search_results = search_query.get_search_results(full_event=True)

        json_results = []
        for result in search_results:
            try:
                json_result = canonicalize_event_data(result.db_event, result.event_keywords)
                json_results.append(json_result)
            except Exception as e:
                logging.error("Error processing event %s: %s" % (result.fb_event_id, e))

        title = self._get_title(city_name, form.keywords.data)
        json_response = {
            'results': json_results,
            'title': title,
            'location': city_name
        }
        if southwest and northeast:
            json_response['location_box'] = {
                'southwest': {
                    'latitude': southwest[0],
                    'longitude': southwest[1],
                },
                'northeast': {
                    'latitude': northeast[0],
                    'longitude': northeast[1],
                },
            }
        self.write_json_success(json_response)


ISO_DATETIME_FORMAT = "%Y-%m-%dT%H:%M:%S"

# Released a version of iOS that requested from /api/v1.1auth, so let's handle that here for awhile
@app.route('/api/v\d+.\d+/?auth')
class AuthHandler(ApiHandler):
    requires_auth = True

    def post(self):
        try:
            self.process()
        except Exception:
            logging.info(traceback.format_exc())
            url = self.request.path
            body = self.request.body
            logging.error("Retrying URL %s", url)
            logging.error("With Payload %r", body)
            taskqueue.add(method='POST', url=url, payload=body,
                countdown=60*60)

    def process(self):
        access_token = self.json_body.get('access_token')
        if not access_token:
            logging.error("Received empty access_token from client. Payload was: %s", self.json_body)
            return
        self.errors_are_fatal() # Assert that our access_token is set

        access_token_expires_with_tz = self.json_body.get('access_token_expires')
        if access_token_expires_with_tz:
            # strip off the timezone, since we can't easily process it
            # TODO(lambert): using http://labix.org/python-dateutil to parse timezones would help with that
            truncated_access_token_expires_without_tz = access_token_expires_with_tz[:-5]
            try:
                access_token_expires = datetime.datetime.strptime(truncated_access_token_expires_without_tz, ISO_DATETIME_FORMAT)
            except ValueError:
                logging.error("Received un-parseable expires date from client: %s", access_token_expires_with_tz)
                access_token_expires = None
        else:
            access_token_expires = None


        location = self.json_body.get('location')
        # Don't use self.get_location_from_headers(), as I'm not sure how accurate it is if called from the API.
        # Also don't use location to update the user, if we don't actually have a location
        client = self.json_body.get('client')
        logging.info("Auth token from client %s is %s", client, access_token)

        user = users.User.get_by_id(self.fb_uid)
        if user:
            logging.info("User exists, updating user with new fb access token data")
            user.fb_access_token = access_token
            user.fb_access_token_expires = access_token_expires
            user.expired_oauth_token = False
            user.expired_oauth_token_reason = ""

            # Track usage stats
            user.last_login_time = datetime.datetime.now()
            if user.last_login_time < datetime.datetime.now() - datetime.timedelta(hours=1):
                if user.login_count:
                    user.login_count += 1
                else:
                    user.login_count = 2 # once for this one, once for initial creation
            if client not in user.clients:
                user.clients.append(client)


            if location:
                # If we had a geocode failure, or had a geocode bug, or we did a geocode bug and only got a country
                if not user.location or 'null' in user.location or ',' not in user.location or re.search(r', \w\w$', user.location):
                    user.location = location
            else:
                # Use the IP address headers if we've got nothing better
                if not user.location:
                    user.location = self.get_location_from_headers()

            user.put() # this also sets to memcache
        else:
            user_creation.create_user_with_fbuser(self.fb_uid, self.fb_user, access_token, access_token_expires, location, client=client)
        self.write_json_success()

class SettingsHandler(ApiHandler):
    requires_auth = True

    def get(self):
        user = users.User.get_by_id(self.fb_uid)
        json_data = {
            'location': user.location,
            'distance': user.distance,
            'distance_units': user.distance_units,
            'send_email': user.send_email,
        }
        self.write_json_success(json_data)

    def post(self):
        user = users.User.get_by_id(self.fb_uid)
        json_request = json.loads(self.request.body)
        if json_request.get('location'):
            user.location = json_request.get('location')
        if json_request.get('distance'):
            user.distance = json_request.get('distance')
        if json_request.get('distance_units'):
            user.distance_units = json_request.get('distance_units')
        if json_request.get('send_email'):
            user.send_email = json_request.get('send_email')
        user.put()

        self.write_json_success()


def canonicalize_event_data(db_event, event_keywords):
    fb_event = db_event.fb_event
    event_api = {}
    for key in ['id', 'name', 'start_time']:
        event_api[key] = fb_event['info'][key]
    # Return an empty description, if we don't have a description for some reason
    event_api['description'] = fb_event['info'].get('description', '')
    # end time can be optional, especially on single-day events that are whole-day events
    event_api['end_time'] = fb_event['info'].get('end_time')

    # cover images
    if fb_event.get('cover_info'):
        # Old FB API versions returned ints instead of strings, so let's stringify manually to ensure we can look up the cover_info
        cover_id = str(fb_event['info']['cover']['cover_id'])
        cover_images = sorted(fb_event['cover_info'][cover_id]['images'], key=lambda x: -x['height'])
        event_api['cover'] = {
            'cover_id': cover_id,
            'images': cover_images,
        }
    else:
        event_api['cover'] = None
    event_api['picture'] = eventdata.get_event_image_url(fb_event)

    # location data
    if 'location' in fb_event['info']:
        venue_location_name = fb_event['info']['location']
    # We could do something like this...
    #elif db_event and db_event.actual_city_name:
    #    venue_location_name = db_event.actual_city_name
    # ...but really, this would return the overridden/remapped address name, which would likely just be a "City" anyway.
    # A city isn't particularly useful for our clients trying to display the event on a map.
    else:
        # In these very rare cases (where we've manually set the location on a location-less event), return ''
        # TODO: We'd ideally like to return None, but unfortunately Android expects this to be non-null in 1.0.3 and earlier.
        venue_location_name = ""
    venue = fb_event['info'].get('venue', {})
    if 'name' in venue and venue['name'] != venue_location_name:
        logging.error("For event %s, venue name %r is different from location name %r", fb_event['info']['id'], venue['name'], venue_location_name)
    venue_id = None
    if 'id' in venue:
        venue_id = venue['id']
    address = None
    if 'country' in venue:
        address = {}
        for key in ['street', 'city', 'state', 'zip', 'country']:
            if key in venue:
                address[key] = venue.get(key)
    geocode = None
    if 'longitude' in venue:
        geocode = {}
        for key in ['longitude', 'latitude']:
            geocode[key] = venue[key]
    # I have seen:
    # - no venue subfields at all (ie, we manually specify the address/location in the event or remapping), which will be returned as "" here (see above comment)
    # - name only (possibly remapped?)
    # - name and id and geocode
    # - name and address and id and geocode
    # - name and address (everything except zip) and id and geocode
    # - so now address can be any subset of those fields that the venue author filled out...but will specify country, at least
    # ...are there more variations? write a mapreduce on recent events to check?
    event_api['venue'] = {
        'name': venue_location_name,
        'id': venue_id,
        'address': address,
        'geocode': geocode,
    }
    # people data
    if 'admins' in fb_event['info']:
        event_api['admins'] = fb_event['info']['admins']['data']
    else:
        event_api['admins'] =  None

    annotations = {}
    if db_event and db_event.creation_time:
        annotations['creation'] = {
            'time': db_event.creation_time.strftime(DATETIME_FORMAT),
            'method': db_event.creating_method,
            'creator': db_event.creating_fb_uid,
        }
    # We may have keywords from the search result that called us
    if event_keywords:
        annotations['dance_keywords'] = event_keywords
        annotations['categories'] = event_keywords
    # or from the db_event associated with this
    elif db_event:
        annotations['dance_keywords'] = db_event.event_keywords
    # or possibly none at all, if we only received a fb_event..
    else:
        pass
    if db_event: # TODO: When is this not true?
        annotations['categories'] = search_base.humanize_categories(db_event.auto_categories)

    event_api['annotations'] = annotations
    # maybe handle: 'ticket_uri', 'timezone', 'updated_time', 'is_date_only'
    rsvp_fields = ['attending_count', 'declined_count', 'maybe_count', 'noreply_count', 'invited_count']
    if 'attending_count' in fb_event['info']:
        event_api['rsvp'] = dict((x, fb_event['info'][x]) for x in rsvp_fields)
    else:
        event_api['rsvp'] = None

    return event_api

@app.route('/api/v\d+.\d+/events/\d+/?')
class EventHandler(ApiHandler):
    def requires_login(self):
        return False

    def get(self):
        path_bits = self.request.path.split('/events/')
        if len(path_bits) != 2:
            self.add_error('Path is malformed: %s' % self.request.path)
            self.response.out.write('Need an event_id.')
            return
        else:
            try:
                event_id = str(int(path_bits[1].strip('/')))
            except TypeError:
                self.add_error('Event id expected: %s' % path_bits[1])

            db_event = eventdata.DBEvent.get_by_id(event_id)
            if db_event.fb_event['empty']:
                self.add_error('This event was %s.' % db_event.fb_event['empty'])

        self.errors_are_fatal()

        json_data = canonicalize_event_data(db_event, None)

        # Ten minute expiry on data we return
        self.response.headers['Cache-Control'] = 'max-age=%s' % (60*10)
        self.write_json_success(json_data)


