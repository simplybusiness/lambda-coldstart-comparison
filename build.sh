#!/bin/bash
declare -a folders=("python" "nodejs6" "nodejs6-diff-package-size")

export AWS_PROFILE=personal

for i in `seq 1 10`;
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
done
