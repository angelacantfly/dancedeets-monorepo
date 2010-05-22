#!/usr/bin/env python

import datetime
import re

from google.appengine.api import urlfetch
import locations
from events import eventdata
from events import tags
import base_servlet

DEBUG = True

class RsvpAjaxHandler(base_servlet.BaseRequestHandler):
    valid_rsvp = ['attending', 'maybe', 'declined']


    def post(self):
        self.finish_preload()
        if not self.request.get('event_id'):
            self.add_error('missing event_id')
        if not self.request.get('rsvp') in self.valid_rsvp:
            self.add_error('invalid or missing rsvp')
        self.errors_are_fatal()

        rsvp = self.request.get('rsvp')
        if rsvp == 'maybe':
            rsvp = 'unsure'

        self.facebook.events.rsvp(int(self.request.get('event_id')), rsvp)

        self.write_json_response(success=True)

    def handle_error_response(self, errors):
        self.write_json_repsonse(success=False, errors=errors)


class ViewHandler(base_servlet.BaseRequestHandler):

    def get(self):
        event_id = int(self.request.get('event_id'))
        self.batch_lookup.lookup_event(event_id)
        self.finish_preload()
        if event_id:
            event_info = self.batch_lookup.events[event_id]
            e = event_info['info']
        
            location = eventdata.get_geocoded_location_for_event(event_info)
            self.display['location'] = location

            e_lat = location['lat']
            e_lng = location['lng']
            # make sure our cookies are keyed by user-id somehow so different users don't conflict
            my_lat = 37.763506
            my_lng = -122.418144
            distance = locations.get_distance(e_lat, e_lng, my_lat, my_lng)

            #TODO(lambert): properly handle venue vs street/city/state/country and location to get authoritative info
            venue = e['venue']
            venue = '%s, %s, %s, %s' % (venue['street'], venue['city'], venue['state'], venue['country'])

            self.display['CHOOSE_RSVPS'] = eventdata.CHOOSE_RSVPS
            self.display['attendee_status'] = eventdata.get_attendence_for_fb_event(event_info, self.facebook.uid)

            friend_ids = set(x['id'] for x in self.current_user()['friends']['data'])
            event_friends = {}
            for rsvp in 'attending', 'maybe', 'declined', 'noreply':
                if rsvp in event_info:
                    rsvp_friends = [x for x in event_info[rsvp]['data'] if x['id'] in friend_ids]
                    rsvp_friends = sorted(rsvp_friends, key=lambda x: x['name'])
                    for friend in rsvp_friends:
                        #TODO(lambert): Do we want to pre-resolve/cache all these image names in the server? Or just keep images disabled?
                        friend['pic'] = 'https://graph.facebook.com/%s/picture?access_token=%s' % (friend['id'], self.facebook.access_token)
                    event_friends[rsvp] = rsvp_friends

            self.display['fb_event'] = e
            for field in ['start_time', 'end_time']:
                self.display[field] = self.localize_timestamp(datetime.datetime.strptime(e[field], '%Y-%m-%dT%H:%M:%S+0000'))
            self.display['distance'] = distance
            self.display['venue'] = venue

            self.display['pic'] = eventdata.get_event_image_url(self.batch_lookup.events[event_id]['picture'], eventdata.EVENT_IMAGE_LARGE)

            db_event = eventdata.get_db_event(event_id)
            tags_set = db_event and set(db_event.tags) or []
            self.display['styles'] = [x[1] for x in tags.STYLES if x[0] in tags_set]
            self.display['types'] = [x[1] for x in tags.TYPES if x[0] in tags_set]
            self.display['event_friends'] = event_friends

            # template rendering
            self.render_template('view')

            # TODO(lambert): maybe offer a link to message the owner
        else:
            self.response.out.write('Need an event_id. Or go to boo.html to login')

class AddHandler(base_servlet.BaseRequestHandler):
    def get(self):
        self.finish_preload()

        self.display['types'] = tags.TYPES
        self.display['styles'] = tags.STYLES

        results_json = self.batch_lookup.users[self.facebook.uid]['events']
        events = sorted(results_json['data'], key=lambda x: x['start_time'])
        for event in events:
            for field in ['start_time', 'end_time']:
                event[field] = self.localize_timestamp(datetime.datetime.strptime(event[field], '%Y-%m-%dT%H:%M:%S+0000'))

        self.display['events'] = events

        self.render_template('add')

    def post(self):
    
        if self.request.get('event_id'):
            event_id = int(self.request.get('event_id'))
        elif self.request.get('event_url'):
            url = self.request.get('event_url')
            if '#' in url:
                url = url.split('#')[1]
            match = re.search('eid=(\d+)', url)
            if not match:
                self.add_error('invalid event_url, expecting eid= parameter')
            event_id = int(match.group(1))
        else:
            self.add_error('missing event_url or event_id parameter')

        self.batch_lookup.lookup_event(event_id)
        try:
            self.finish_preload()
        except FacebookException, e:
            self.add_error(str(e))

        self.errors_are_fatal()
        e = eventdata.get_db_event(event_id)
        if not e:
            e = eventdata.DBEvent(fb_event_id=event_id)
            e.make_findable_for(self.batch_lookup.events[event_id])
        e.tags = self.request.get_all('tag')
        e.put()

        self.response.out.write('Thanks for submitting!<br>\n')
        self.response.out.write('<a href="/events/view?event_id=%s">View Page</a>' % event_id)
