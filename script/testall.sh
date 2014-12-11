#!/bin/bash

# http://stackoverflow.com/questions/15429330/how-to-specify-a-multi-line-shell-variable
read -d '' files << EOF
./test/
./test/common/**
./test/common/StateTests/*.long
EOF

mocha --timeout 999900000 --reporter spec $files
