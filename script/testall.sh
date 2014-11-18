#!/bin/bash

# http://stackoverflow.com/questions/15429330/how-to-specify-a-multi-line-shell-variable
read -d '' files << EOF
./test/
./test/common/**
./test/common/StateTests/*.long
EOF

./script/eslint.sh

mocha --timeout 5000 --reporter spec $files
