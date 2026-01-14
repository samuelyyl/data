#!/bin/bash
cd $(dirname $0)
pwd
source .env
ENCRYPT_PASSWORD=$ENCRYPT_PASSWORD npm run build