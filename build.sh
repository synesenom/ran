#!/usr/bin/env bash

# minify
uglifyjs \
    src/ran.js \
    -m \
    --output ran.min.js

# make doc
python docs/src/parser.py