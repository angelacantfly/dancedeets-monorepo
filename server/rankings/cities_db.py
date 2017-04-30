import logging
import sqlite3

from loc import math
from loc import names

FILENAME = 'rankings/cities.db'

"""
class City(object):
    def __init__(self)
    created_date = db.DateTimeProperty(auto_now_add=True)

    city_name = db.StringProperty()
    state_name = db.StringProperty(indexed=False)
    country_name = db.StringProperty()
    latitude = db.FloatProperty(indexed=False)
    longitude = db.FloatProperty(indexed=False)
    population = db.IntegerProperty()
    timezone = db.StringProperty()
    geohashes = db.StringListProperty()

    # This indicates whether any events are "tagged" against this City
    # This can be used to filter out unnecessary cities in searches that don't have events/people associated with them
    has_nearby_events = db.BooleanProperty()
"""

# The km of distance to nearest "scene" a user will identify with
# We group events into cities by NEARBY_DISTANCE_KM/2,
# then later everything expands by NEARBY_DISTANCE_KM in searching:
# - expand our search box by this
# - find people within this distance of our search box, too
NEARBY_DISTANCE_KM = 100

def get_nearby_city(latlng, country=None):
    # We shrink it by two:
    # An event in Palo Alto could be thrown into a San Jose bucket
    # But an event in San Francisco, looking for "people who would go to SF event",
    # would want to include Palo Alto in its search radius....so would need to go 2x to San Jose
    # So instead of searching 200km in popular people for cities...let's try to be more specific about which person goes to which city
    southwest, northeast = math.expand_bounds((latlng, latlng), NEARBY_DISTANCE_KM/2)
    nearby_cities = get_nearby_cities((southwest, northeast), country=country)
    city = get_largest_city(nearby_cities)
    return city

class City(object):
    def __init__(self, data):
        self.__dict__ = dict((x, data[x]) for x in data.keys())

    def display_name(self):
        if self is None:
            return 'Unknown'
        full_country = names.get_country_name(self.country_code)
        if self.country_code in ['US']:
            city_name = '%s, %s, %s' % (self.ascii_name, self.admin1_code, full_country)
        else:
            city_name = '%s, %s' % (self.ascii_name, full_country)
        return city_name

def get_nearby_cities(points, country=None):
    logging.info("search location is %s", points)
    values = [points[0][0], points[1][0], points[0][1], points[1][1]]
    query = ''
    if country:
        values += [country]
        query = ' and country_code = ?',
    connection = sqlite3.connect(FILENAME)
    connection.row_factory = sqlite3.Row
    cursor = connection.cursor()
    cursor.execute('select * from City where ? < latitude and latitude < ? and ? < longitude and longitude < ? %s order by population desc' % query, values)
    results = cursor.fetchall()
    return [City(x) for x in results]

def get_largest_cities(limit=5, country=None):
    raise NotImplementedError()

def get_largest_city(cities):
    if not cities:
        return None
    largest_nearby_city = max(cities, key=lambda x: x.population)
    return largest_nearby_city
