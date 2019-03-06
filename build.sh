#!/bin/bash
declare -a folders=("ruby25" "nodejs6" "ruby25vpc")

# export AWS_PROFILE=personal

for i in `seq 1 50`;
do
  echo ""
  echo "====== Iteration ${i} ======"

  for folder in "${folders[@]}"
  do
    cd $folder
    pwd

    sls deploy --force

    cd ..
  done

  node invoke-functions.js
  # node call-endpoints.js
done
