#!/bin/bash

# run jshint on modified js files
git diff $(git merge-base HEAD origin/HEAD) --name-only --diff-filter=ACM | grep -v node_modules | grep ".js$" | xargs node_modules/.bin/jshint
