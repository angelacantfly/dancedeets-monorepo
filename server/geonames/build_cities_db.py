#!/usr/bin/python

from __future__ import absolute_import

import json
import re
import sqlite3
import sys
import urllib

import facebook
from util import urls
from geonames import geoname_files
from geonames import sqlite_db
from geonames import fetch_adgeolocs

def get_fb_targeting_key(cursor_adlocs, geoname):
    q = fetch_adgeolocs.get_query(geoname)
    country_code = geoname.country_code
    db_result = cursor_adlocs.execute('SELECT data from AdGeoLocation where q = ? and country_code = ?', (q, country_code)).fetchone()
    results = json.loads(db_result[0])
    if results:
        return results[0]['key']
    else:
        return None

def save_cities_db(cities_db_filename):

    conn_adlocs = sqlite3.connect(fetch_adgeolocs.FILENAME_ADLOCS)
    cursor_adlocs = conn_adlocs.cursor()

    conn_cities = sqlite3.connect(cities_db_filename)
    cursor_cities = conn_cities.cursor()
    cursor_cities.execute('''DROP TABLE IF EXISTS City''')
    cursor_cities.execute('''CREATE TABLE City
                 (geoname_id integer primary key, ascii_name text, admin1_code text, country_code text, latitude real, longitude real, population integer, timezone text, adgeolocation_key)''')
    # We index on longitude first, since it's likely to have the greatest variability and pull in the least amount of cities
    cursor_cities.execute('''CREATE INDEX geo on City (country_code, longitude, latitude);''')
    for geoname in geoname_files.cities(5000):
        adgeolocation_key = get_fb_targeting_key(cursor_adlocs, geoname)

        if not geoname.population:
            print geoname.geoname_id, geoname.ascii_name, geoname.population
        data = {
            'geoname_id': geoname.geoname_id,
            'ascii_name': geoname.ascii_name,
            'admin1_code': geoname.admin1_code,
            'country_code': geoname.country_code,
            'latitude': geoname.latitude,
            'longitude': geoname.longitude,
            'population': geoname.population or 0,
            'timezone': geoname.timezone,
            'adgeolocation_key': adgeolocation_key,
        }
        sqlite_db.insert_record(cursor_cities, 'City', data)

    conn_cities.commit()
    conn_adlocs.commit()

if __name__ == '__main__':
    save_cities_db(sys.argv[1])
