#!/bin/bash
declare -a folders=("ruby25" "nodejs6" "ruby25vpc")

for folder in "${folders[@]}"
do
  cd $folder
  pwd

  sls remove

  cd ..
done
