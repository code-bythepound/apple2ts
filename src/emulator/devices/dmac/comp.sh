#!/bin/sh
em++ --no-entry linear.cpp -o DMACLib.js -s ENVIRONMENT=web -s SINGLE_FILE=1 -s MODULARIZE=1 -s EXPORT_NAME='DMACLib' -s WASM=1 -s EXPORTED_RUNTIME_METHODS=getValue,setValue,addFunction -s ALLOW_TABLE_GROWTH=1
sed -i '1 s/^/export\n/' DMACLib.js
