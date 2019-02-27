#!/bin/bash
declare -a folders=("python" "nodejs6" "ruby25" "ruby25vpc")

for folder in "${folders[@]}"
do
  cd $folder
  pwd

  sls remove

  cd ..
done
