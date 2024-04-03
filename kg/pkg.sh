#!/bin/bash

workdir=$(cd $(dirname $0); pwd)
echo $workdir
webpack --config  ./webpack.config.js