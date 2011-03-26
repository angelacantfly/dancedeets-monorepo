import logging
import time
from google.appengine.ext import db
from google.appengine.ext import webapp
from google.appengine.ext import deferred

from util.mapper import Mapper
from events import cities
from events import eventdata
from events import users
import fb_api
from logic import event_classifier

class MyModelMapper(Mapper):
    KIND = users.User

    def map(self, entity):
        #entity.min_attendees = 0
        #return ([entity], [])
        return ([], [])

class OneOffHandler(webapp.RequestHandler):
    def get(self):
        m = MyModelMapper()
        m.run()
        return
        es = eventdata.DBEvent.gql('where address != :addr', addr=None).fetch(500)
        self.response.out.write('len is %s<br>\n' % len(es))
        for e in es:
            if e:
                e.address = None
                e.put()
        self.response.out.write('yay!')

class ImportCitiesHandler(webapp.RequestHandler):
    def get(self):
        cities.import_cities()
        self.response.out.write("Imported Cities!")


class DBEventMapper(Mapper):
    KIND = eventdata.DBEvent

    def map(self, entity):
        if entity.key().name():
            return ([], [])

        new_entity = eventdata.DBEvent(
            key_name = str(entity.__dict__['_entity']['fb_event_id']),
            tags = entity.tags,
            creating_fb_uid = entity.creating_fb_uid,
        )

        return ([new_entity], [entity])

class MigrateDBEventsHandler(webapp.RequestHandler):
    def get(self):
        m = DBEventMapper()
        m.run()
        #deferred.defer(m.run)
        self.response.out.write('Trigger DBEvent Migration Mapreduce!')

class ClearMemcacheHandler(webapp.RequestHandler):
    def get(self):
        smemcache.flush_all()
        self.response.out.write("Flushed memcache!")


